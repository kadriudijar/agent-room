import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { detailLines, headerLine, logLines } from '../text.ts'

const NOW = Date.parse('2026-10-23T10:00:00Z')
const busy = () => JSON.parse(readFileSync(
  new URL(
    './fixtures/busy.json',
    import.meta.url),
  'utf8')) as RoomFile[]

test(
  'header counts rooms, agents, working, helpers and needs you',
  () => {
    const rooms = busy()
    rooms[2].updatedAt = 10
    rooms[2].usage = [
      { kind: 'five_hour', percent: 23.5, resetsAt: '2026-10-23T12:14:00Z' },
      { kind: 'seven_day', percent: 61, resetsAt: '2026-10-26T14:00:00Z' },
    ]

    assert.equal(
      headerLine(
        rooms,
        NOW,
        200),
      'Agent Room · 3 rooms · 7 agents · 5 working · 4 helpers · 1 needs you · 5h 23.5% · resets in 2h14m · week 61% · resets in 3d4h')
  })

test(
  'header shows dashes before any usage',
  () => {
    assert.match(
      headerLine(
        busy(),
        NOW,
        200),
      /· 5h – · week –$/)
  })

test(
  'header is cut to the width',
  () => {
    const line = headerLine(
      busy(),
      NOW,
      30)

    assert.equal(
      [...line].length,
      30)
    assert.ok(line.endsWith('…'))
  })

test(
  'log merges rooms newest first and is one line each',
  () => {
    const rooms = busy()
    rooms[0].log = [{ at: NOW - 2000, agentId: 'a1', icon: 'bash', label: '$ npm\ntest' }]
    rooms[1].log = [{ at: NOW - 1000, agentId: null, icon: 'ask', label: 'Asking you' }]
    const lines = logLines(
      rooms,
      6,
      120)

    assert.equal(
      lines.length,
      2)
    assert.equal(
      lines[0].icon,
      'ask')
    assert.match(
      lines[0].text,
      /^\d\d:\d\d:\d\d  main  app-mobile  Asking you$/)
    assert.match(
      lines[1].text,
      /Explore  profiles-36  \$ npm test$/)
  })

test(
  "details show the agent's task and its recent actions",
  () => {
    const rooms = busy()
    rooms[0].agents[1].description = 'find tests'
    rooms[0].log = [{ at: NOW, agentId: 'a1', icon: 'bash', label: '$ npm test' }]
    const lines = detailLines(
      rooms[0],
      rooms[0].agents[1],
      80)

    assert.ok(lines.some(line => line.text.includes('find tests')))
    assert.ok(lines.some(line => line.icon === 'bash' && line.text.includes('$ npm test')))
    assert.ok(lines.every(line => [...line.text].length <= 80))
  })

test(
  'control and bidi characters from room files never reach the terminal',
  () => {
    const rooms = busy()
    rooms[0].name = 'evil\x1b]2;pwned\x07‮'
    rooms[0].log = [{ at: NOW, agentId: null, icon: 'bash', label: '$ printf \x1b[2J\x9b' }]
    const lines = [
      ...logLines(
        rooms,
        6,
        200).map(line => line.text),
      headerLine(
        rooms,
        NOW,
        200),
      ...detailLines(
        rooms[0],
        rooms[0].agents[0],
        200).map(line => line.text),
    ]

    for (const line of lines) assert.doesNotMatch(
      line,
      /[\x00-\x1f\x7f-\x9f‪-‮⁦-⁩]/)
  })
