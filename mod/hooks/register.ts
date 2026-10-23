import type { AgentInfo, EngineInterface, Register, SessionRateLimit } from 'claude-code'
import type { Action, DeskAgent, LogEntry, RoomFile, Usage } from '../types'

const LOG_LIMIT = 50
const DONE_LINGER_MS = 10_000

type Room = Omit<RoomFile, 'updatedAt'>

let room: Room | undefined
let file = ''
let lastText = ''
let lastWriteAt = 0
let configDir = ''
// A spare (pre-warmed) or SDK-run session is not one the developer opened: it writes no room.
let hidden = false
let wroteFile = false
let timers: { cancel: () => void }[] = []
// When each finished subagent was first seen done, so its desk clears 10 s later.
const doneAt = new Map<string, number>()
// Tool calls waiting on the developer (a permission ask, a question), per agent ('' is main).
const waiting = new Map<string, Set<string>>()
// Desks seen before $.agent.list() names them, keyed by agent id.
const seen = new Map<string, DeskAgent>()

const oneLine = (text: string) => {
  const line = text
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
  return line.length > 80
    ? `${line.slice(
      0,
      79)}…`
    : line
}

const field = (input: unknown, name: string) => {
  const value = (input as Record<string, unknown> | undefined)?.[name]
  return typeof value === 'string' ? value : ''
}

const basename = (path: string) => path
  .split('/')
  .filter(Boolean)
  .at(-1) ?? path

const host = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export const actionOf = (tool: string, input: unknown): Action => {
  const action = (icon: Action['icon'], label: string): Action => ({ icon, label: oneLine(label) })
  switch (tool) {
    case 'Read': return action(
      'read',
      basename(field(input, 'file_path')))
    case 'Grep':
    case 'Glob': return action(
      'read',
      field(input, 'pattern'))
    case 'Edit':
    case 'Write': return action(
      'edit',
      basename(field(input, 'file_path')))
    case 'NotebookEdit': return action(
      'edit',
      basename(field(input, 'notebook_path')))
    case 'Bash': return action(
      'bash',
      `$ ${field(input, 'command').split('\n')[0]}`)
    case 'WebFetch': return action(
      'web',
      host(field(input, 'url')))
    case 'WebSearch': return action(
      'web',
      field(input, 'query'))
    case 'Agent': return action(
      'agent',
      field(input, 'description'))
    case 'AskUserQuestion': return action(
      'ask',
      'Asking you')
    default: return action(
      'other',
      tool)
  }
}

const mainDesk = (): DeskAgent => ({
  id: null,
  parentId: null,
  name: 'main',
  type: 'main',
  description: '',
  status: 'idle',
  needsYou: false,
  action: null,
})

const statusOf = (status: AgentInfo['status']): DeskAgent['status'] =>
  status === 'running' || status === 'pending' ? 'running'
    : status === 'waiting' || status === 'idle' ? 'idle'
      : 'done'

const desk = (agentId: string | undefined) => {
  if (!room) return undefined
  if (agentId === undefined) return room.agents[0]
  let found = room.agents.find(agent => agent.id === agentId) ?? seen.get(agentId)
  if (!found) {
    found = { ...mainDesk(), id: agentId, name: 'helper', type: 'helper' }
    seen.set(
      agentId,
      found)
    room.agents.push(found)
  }
  return found
}

const usageOf = (rateLimits: SessionRateLimit[]): Usage[] => rateLimits
  .filter(limit => limit.kind === 'five_hour' || limit.kind === 'seven_day')
  .map(limit => ({ kind: limit.kind as Usage['kind'], percent: limit.percentUsed, resetsAt: limit.resetsAt }))

type SessionEntry = { pid?: number; sessionId?: string; procStart?: string; name?: string; spare?: boolean; entrypoint?: string }

// This session's entry in Claude Code's sessions folder: its pid, process start and name.
const sessionEntry = async ($: EngineInterface, configDir: string, sessionId: string) => {
  const dir = `${configDir}/sessions`
  const entries = await $.fs
    .list(dir)
    .catch(() => [])
  for (const entry of entries.filter(entry => entry.name.endsWith('.json'))) {
    const session = await $.fs
      .read(`${dir}/${entry.name}`)
      .then(text => JSON.parse(text) as SessionEntry)
      .catch(() => undefined)
    if (session?.sessionId === sessionId) return session
  }
  return undefined
}

// Folds $.agent.list() into the desks: main first, subagents as the list orders them.
const refreshAgents = async ($: EngineInterface) => {
  if (!room) return
  const now = await $.clock.now()
  const listed = await $.agent
    .list()
    .catch(() => [] as AgentInfo[])
  const desks = listed
    .map(info => {
      const known = room!.agents.find(agent => agent.id === info.id) ?? seen.get(info.id)
      const status = statusOf(info.status)
      if (status !== 'done') doneAt.delete(info.id)
      else if (!doneAt.has(info.id)) doneAt.set(
        info.id,
        now)
      return {
        id: info.id,
        parentId: info.parentId ?? null,
        name: info.name ?? info.type,
        type: info.type,
        description: info.description,
        status,
        needsYou: false,
        action: known?.action ?? null,
      }
    })
    .filter(agent => agent.status !== 'done' || now - doneAt.get(agent.id)! < DONE_LINGER_MS)
  // A desk a tool call made before the list caught up stays until the list names it.
  const pending = [...seen.values()].filter(agent => !listed.some(info => info.id === agent.id))
  for (const info of listed) seen.delete(info.id)
  room.agents = [room.agents[0], ...desks, ...pending]
  for (const agent of room.agents) agent.needsYou = (waiting.get(agent.id ?? '')?.size ?? 0) > 0
}

const wait = (agentId: string | undefined, callId: string, isWaiting: boolean) => {
  const key = agentId ?? ''
  const calls = waiting.get(key) ?? new Set<string>()
  if (isWaiting) calls.add(callId)
  else calls.delete(callId)
  waiting.set(
    key,
    calls)
}

// Re-reads the entry: a /rename, and a spare session claimed for real use, show within 5 s.
const refreshEntry = async ($: EngineInterface) => {
  if (!room) return
  const entry = await sessionEntry(
    $,
    configDir,
    room.sessionId)
  if (!entry) return
  hidden = entry.spare === true || (entry.entrypoint ?? '').startsWith('sdk')
  room.name = entry.name ?? room.name
  room.pid = entry.pid ?? room.pid
  room.procStart = entry.procStart ?? room.procStart
}

const flush = async ($: EngineInterface) => {
  if (!room) return
  if (hidden) {
    if (wroteFile) await $.process.run([
      'rm',
      '-f',
      file,
    ])
    wroteFile = false
    lastText = ''
    return
  }
  await refreshAgents($)
  const text = JSON.stringify(room)
  const now = await $.clock.now()
  // Unchanged, the file is still rewritten every 5 s: the viewer may have removed it, and pid-less rooms need a fresh updatedAt.
  if (text === lastText && now - lastWriteAt < 5_000) return
  lastText = text
  lastWriteAt = now
  const snapshot: RoomFile = { ...room, updatedAt: now }
  await $.fs.write(
    file,
    JSON.stringify(snapshot))
  wroteFile = true
}

const log = async ($: EngineInterface, agentId: string | null, action: Action) => {
  if (!room) return
  const entry: LogEntry = { at: await $.clock.now(), agentId, ...action }
  room.log = [...room.log, entry].slice(-LOG_LIMIT)
}

// Starts this session's room: at session.start, and again under the new id after /clear or /resume.
const init = async ($: EngineInterface) => {
  configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
  const sessionId = await $.session.id()
  const entry = await sessionEntry(
    $,
    configDir,
    sessionId)
  file = `${configDir}/agent-room/${sessionId}.json`
  lastText = ''
  lastWriteAt = 0
  wroteFile = false
  waiting.clear()
  hidden = entry?.spare === true || (entry?.entrypoint ?? '').startsWith('sdk')
  seen.clear()
  doneAt.clear()
  room = {
    version: 1,
    sessionId,
    name: entry?.name ?? sessionId.slice(0, 8),
    cwd: await $.session.cwd(),
    pid: entry?.pid ?? 0,
    procStart: entry?.procStart ?? '',
    agents: [mainDesk()],
    usage: usageOf((await $.session.usage()).rateLimits),
    log: [],
  }
  for (const timer of timers) timer.cancel()
  timers = [
    $.clock.every(
      300,
      () => void flush($).catch(() => undefined)),
    $.clock.every(
      5_000,
      () => void refreshEntry($).catch(() => undefined)),
    $.clock.every(
      60_000,
      () => void $.session
        .usage()
        .then(usage => {
          if (room) room.usage = usageOf(usage.rateLimits)
        })
        .catch(() => undefined)),
  ]
}

export const register: Register = on => {
  on(
    'session.start',
    async ($, e, next) => {
      const started = await next(e)
      // Off the engine's path to the first prompt; display only, so a failure leaves no room and nothing else.
      void init($).catch(() => undefined)
      return started
    })

  on(
    'tool.call',
    async ($, e, next) => {
      const agent = desk(e.agentId)
      if (agent) {
        agent.action = actionOf(
          e.tool,
          e)
        agent.status = 'running'
        if (e.tool === 'AskUserQuestion') wait(
          e.agentId,
          e.tool_use_id ?? 'question',
          true)
        await log(
          $,
          e.agentId ?? null,
          agent.action).catch(() => undefined)
      }
      try {
        return await next(e)
      } finally {
        wait(
          e.agentId,
          e.tool_use_id ?? 'question',
          false)
      }
    })

  on(
    'tool.check',
    async ($, e, next) => {
      const verdict = await next(e)
      // Only a call of the session's own that the person is asked about: never a plugin's query.
      if (verdict.decision === 'ask' && e.tool_use_id && e.approver !== 'host') wait(
        e.agentId,
        e.tool_use_id,
        true)
      return verdict
    })

  on(
    'turn.start',
    async ($, e, next) => {
      if (e.agentId === undefined && room) room.agents[0].status = 'running'
      return next(e)
    })

  on(
    'turn.complete',
    async ($, e, next) => {
      waiting.delete(e.agentId ?? '')
      if (e.agentId === undefined && room) Object.assign(
        room.agents[0],
        { status: 'idle', action: null })
      return next(e)
    })

  on(
    'session.measure',
    async ($, e, next) => {
      if (room && e.rateLimits) room.usage = usageOf(e.rateLimits)
      return next(e)
    })

  on(
    'session.end',
    async ($, e, next) => {
      for (const timer of timers) timer.cancel()
      timers = []
      if (room && wroteFile) await $.process
        .run([
          'rm',
          '-f',
          file,
        ])
        .catch(() => undefined)
      room = undefined
      const ended = await next(e)
      // /clear and /resume go on in this process under a new session id, with no session.start.
      if (e.reason === 'clear' || e.reason === 'resume') await init($).catch(() => undefined)
      return ended
    })
}
