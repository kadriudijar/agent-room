import type { DeskAgent, Icon, RoomFile } from '../mod/types/index.d.ts'

export const GLYPHS: Record<Icon, string> = {
  read: '📖',
  edit: '✏️',
  bash: '$',
  web: '🌐',
  agent: '🤝',
  ask: '❓',
  other: '·',
}

const oneLine = (text: string) => text
  .replace(/\s+/g, ' ')
  .trim()

// Room files are written from tool input: control and bidi characters would reach the terminal as escapes.
const UNSAFE = /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g

// Cuts to `cols` code points, ending with `…` when cut; every printed line passes through here.
export const cut = (text: string, cols: number) => {
  const chars = [...text.replace(UNSAFE, '')]
  return chars.length <= cols ? chars.join('') : `${chars
    .slice(
      0,
      Math.max(
        0,
        cols - 1))
    .join('')}…`
}

const countdown = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const minutes = Math.max(
    0,
    Math.round((Date.parse(resetsAt) - now) / 60_000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  return ` ↻${d ? `${d}d${h}h` : h ? `${h}h${m}m` : `${m}m`}`
}

export const headerLine = (rooms: RoomFile[], now: number, cols: number) => {
  const agents = rooms.flatMap(r => r.agents)
  const newest = [...rooms].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const limit = (kind: string, label: string) => {
    const usage = newest?.usage.find(u => u.kind === kind)
    return usage ? `${label} ${usage.percent}%${countdown(usage.resetsAt, now)}` : `${label} –`
  }
  return cut(
    [
      'Agent Room',
      `${rooms.length} rooms`,
      `${agents.length} agents`,
      `${agents.filter(a => a.status === 'running').length} working`,
      `${agents.filter(a => a.id !== null).length} helpers`,
      `${agents.filter(a => a.needsYou).length} needs you`,
      limit(
        'five_hour',
        '5h'),
      limit(
        'seven_day',
        'week'),
    ].join(' · '),
    cols)
}

const clock = (at: number) => new Date(at)
  .toTimeString()
  .slice(
    0,
    8)

const agentName = (room: RoomFile, agentId: string | null) =>
  room.agents.find(a => a.id === agentId)?.name ?? (agentId === null ? 'main' : 'helper')

export const logLines = (rooms: RoomFile[], count: number, cols: number) => rooms
  .flatMap(room => room.log.map(entry => ({ room, entry })))
  .sort((a, b) => b.entry.at - a.entry.at)
  .slice(
    0,
    count)
  .map(({ room, entry }) => cut(
    `${clock(entry.at)}  ${agentName(
      room,
      entry.agentId)}  ${room.name}  ${GLYPHS[entry.icon]} ${oneLine(entry.label)}`,
    cols))

export const detailLines = (room: RoomFile, agent: DeskAgent, cols: number) => [
  `${agent.name} · ${agent.type} · ${agent.status}${agent.needsYou ? ' · needs you' : ''} · ${room.name}`,
  agent.description ? `Task: ${oneLine(agent.description)}` : `Session folder: ${room.cwd}`,
  ...room.log
    .filter(entry => entry.agentId === agent.id)
    .slice(-5)
    .reverse()
    .map(entry => `  ${clock(entry.at)}  ${GLYPHS[entry.icon]} ${oneLine(entry.label)}`),
].map(line => cut(
  line,
  cols))
