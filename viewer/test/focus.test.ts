import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { focusSession } from '../focus.ts'

const room = (extra: Partial<RoomFile> = {}): RoomFile => ({
  version: 1,
  sessionId: 's',
  name: 'profiles-36',
  cwd: '/Users/dev/app',
  pid: 1,
  procStart: '',
  updatedAt: 0,
  agents: [],
  usage: [],
  log: [],
  ...extra,
})

// Stands for osascript: answers the terminal list, records each focus.
const ghostty = (terminals: string[][]) => {
  const focused: string[] = []
  const run = async (script: string) => {
    const id = /terminal id "([^"]+)"/.exec(script)?.[1]
    if (id) {
      focused.push(id)
      return ''
    }
    return terminals.map(t => t.join('\t')).join('\n')
  }
  return { focused, run }
}

test(
  "focuses the terminal in the session's folder",
  async () => {
    const g = ghostty([['T1', 'zsh', '/Users/dev/other'], ['T2', '✳ Claude Code', '/Users/dev/app']])

    assert.deepEqual(
      await focusSession(
        room(),
        g.run),
      { ok: true })
    assert.deepEqual(
      g.focused,
      ['T2'])
  })

test(
  'two tabs in one folder: the one titled with the session name wins',
  async () => {
    const g = ghostty([['T1', 'zsh', '/Users/dev/app'], ['T2', 'profiles-36 · Claude', '/Users/dev/app']])
    await focusSession(
      room(),
      g.run)

    assert.deepEqual(
      g.focused,
      ['T2'])
  })

test(
  'no terminal in the folder says which session it is',
  async () => {
    const g = ghostty([['T1', 'zsh', '/Users/dev/other']])

    assert.deepEqual(
      await focusSession(
        room(),
        g.run),
      { ok: false, reason: 'No Ghostty tab found for profiles-36 (/Users/dev/app)' })
    assert.deepEqual(
      g.focused,
      [])
  })

test(
  'osascript failing says why',
  async () => {
    const result = await focusSession(
      room(),
      async () => {
        throw new Error('Not authorized to send Apple events to Ghostty.')
      })

    assert.deepEqual(
      result,
      { ok: false, reason: 'Ghostty would not switch tabs: Not authorized to send Apple events to Ghostty.' })
  })
