import { expect, mock, test } from 'claude-code/testing'
import type { RoomFile } from '../types'
import { actionOf } from '../hooks/register'

const FILE = '/Users/dev/.claude/agent-room/session-b.json'

// Stands for the engine: Claude Code's sessions folder, the agents list and the file system.
const world = (on: Parameters<Parameters<typeof test>[1]>[1], agents: unknown[] = [], entry: Record<string, unknown> = {}) => {
  const clock = mock.clock(
    on,
    { now: 1_000_000 })
  const writes: { path: string; text: string }[] = []
  const runs: string[][] = []
  mock.env(
    on,
    { HOME: '/Users/dev' })
  on(
    'session.id',
    () => ({ value: 'session-b' }))
  on(
    'session.cwd',
    () => ({ value: '/Users/dev/app' }))
  on(
    'session.usage',
    () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }))
  on(
    'fs.list',
    () => ({ value: [{ name: '4242.json', kind: 'file', size: 0, mtimeMs: 0, isLink: false }] }))
  on(
    'fs.read',
    () => ({
      value: JSON.stringify({
        pid: 4242,
        sessionId: 'session-b',
        procStart: 'Fri Oct 23 18:38:20 2026',
        name: 'profiles-36',
        ...entry,
      }),
    }))
  on(
    'fs.write',
    (_, e) => {
      writes.push(e)
      return { value: undefined }
    })
  on(
    'process.run',
    (_, e) => {
      runs.push([...e.argv])
      return { value: { code: 0, stdout: '', stderr: '' } }
    })
  on(
    'agent.list',
    () => ({ value: agents }))
  on(
    'session.start',
    (_, e) => ({ cwd: e.cwd }))
  on(
    'tool.call',
    () => ({ result: {} }))
  const last = () => JSON.parse(writes.at(-1)!.text) as RoomFile
  return { clock, writes, runs, last }
}

test(
  'writes the room file named by session id',
  async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await w.clock.advance(300)

    expect(w.writes.at(-1)?.path)

      .toBe(FILE)
    expect(w.last().name)
      .toBe('profiles-36')
    expect(w.last().pid)
      .toBe(4242)
    expect(w.last().procStart)
      .toBe('Fri Oct 23 18:38:20 2026')
    expect(w.last().agents[0].id)
      .toBe(null)
  })

test(
  "a Read call shows on main's desk and in the log",
  async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Read', file_path: '/a/b/api.ts' })
    await w.clock.advance(300)

    expect(w.last().agents[0].action)

      .toEqual({ icon: 'read', label: 'api.ts' })
    expect(w.last().log.at(-1)?.agentId)
      .toBe(null)
  })

test(
  "a subagent's call lands on its own desk",
  async ($, on) => {
    const w = world(
      on,
      [{ id: 'a1', type: 'Explore', description: 'find tests', status: 'running' }])
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'npm test\nmore', agentId: 'a1' })
    await w.clock.advance(300)
    const desk = w.last().agents.find(agent => agent.id === 'a1')

    expect(desk?.action?.label)

      .toBe('$ npm test')
    expect(desk?.parentId)
      .toBe(null)
    expect(desk?.name)
      .toBe('Explore')
    expect(desk?.status)
      .toBe('running')
  })

test(
  'needs you is set while a permission ask waits and cleared after',
  async ($, on) => {
    const w = world(on)
    on(
      'tool.check',
      () => ({ decision: 'ask' }))
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await $.tool.check({ tool: 'Bash', input: { command: 'rm x' } })
    await w.clock.advance(300)

    expect(w.last().agents[0].needsYou)

      .toBe(true)

    await $.tool.call({ tool: 'Bash', command: 'rm x' })
    await w.clock.advance(300)

    expect(w.last().agents[0].needsYou)

      .toBe(false)
  })

test(
  'labels are one line and capped at 80 chars',
  async () => {
    const label = actionOf(
      'Bash',
      { command: 'x'.repeat(300) }).label

    expect(label.length)

      .toBe(80)
    expect(label.endsWith('…'))
      .toBe(true)
  })

test(
  'log keeps the newest 50',
  async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    for (let i = 1; i <= 60; i++) await $.tool.call({ tool: 'Bash', command: `echo ${i}` })
    await w.clock.advance(300)

    expect(w.last().log.length)

      .toBe(50)
    expect(w.last().log.at(-1)?.label)
      .toBe('$ echo 60')
  })

test(
  'the file is removed on session end',
  async ($, on) => {
    const w = world(on)
    on(
      'session.end',
      () => ({ sessionId: 'session-b' }))
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await w.clock.advance(300)
    await $.session.end({ reason: 'exit' })

    expect(w.runs)

      .toContainEqual(['rm', '-f', FILE])
  })

test(
  'spare and SDK sessions write no room',
  async ($, on) => {
    const w = world(
      on,
      [],
      { entrypoint: 'sdk-cli' })
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await w.clock.advance(6_000)

    expect(w.writes.filter(write => write.path === FILE).length)
      .toBe(0)
  })

test(
  'a rename shows within 5 s',
  async ($, on) => {
    const entry: Record<string, unknown> = {}
    const w = world(
      on,
      [],
      entry)
    await $.session.start({ cwd: '/Users/dev/app', surface: 'terminal', isInteractive: true })
    await w.clock.advance(300)
    entry.name = 'agent-room'
    await w.clock.advance(5_000)

    expect(w.last().name)
      .toBe('agent-room')
  })
