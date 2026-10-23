import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DeskAgent, RoomFile } from '../../mod/types/index.d.ts'
import { BREAK_AFTER_MS, createBreaks, WALK_MS } from '../breaks.ts'
import { layoutOffice } from '../office.ts'

const T0 = 1_800_000_000_000

const agent = (status: DeskAgent['status'], since: number): DeskAgent => ({
  id: null,
  parentId: null,
  name: 'main',
  type: 'main',
  description: '',
  status,
  since,
  needsYou: false,
  action: null,
})

const room = (a: DeskAgent): RoomFile => ({
  version: 1,
  sessionId: 's',
  name: 's',
  cwd: '/x',
  pid: 1,
  procStart: '',
  updatedAt: 0,
  agents: [a],
  usage: [],
  log: [],
})

const setup = (a: DeskAgent) => {
  const rooms = [room(a)]
  return { rooms, office: layoutOffice(
    rooms,
    640,
    400), breaks: createBreaks() }
}

test(
  'an agent waiting 5 minutes walks to the kitchen',
  () => {
    const { rooms, office, breaks } = setup(agent(
      'idle',
      T0))

    assert.equal(
      breaks
        .update(
          office,
          rooms,
          T0 + BREAK_AFTER_MS - 1)
        .size,
      0)
    breaks.update(
      office,
      rooms,
      T0 + BREAK_AFTER_MS)
    const walking = breaks
      .update(
        office,
        rooms,
        T0 + BREAK_AFTER_MS + WALK_MS / 2)
      .get('s:')!
    const kitchen = office.rooms.find(r => r.kind === 'kitchen')!
    const there = breaks
      .update(
        office,
        rooms,
        T0 + BREAK_AFTER_MS + WALK_MS)
      .get('s:')!

    assert.equal(
      walking.isWalking,
      true)
    assert.equal(
      there.isWalking,
      false)
    assert.ok(there.x >= kitchen.x && there.x < kitchen.x + kitchen.w && there.y >= kitchen.y && there.y < kitchen.y + kitchen.h)
  })

test(
  'a working agent never leaves its desk',
  () => {
    const { rooms, office, breaks } = setup(agent(
      'running',
      T0))

    assert.equal(
      breaks
        .update(
          office,
          rooms,
          T0 + BREAK_AFTER_MS * 3)
        .size,
      0)
  })

test(
  'a recalled agent walks back to its desk and stays for another 5 minutes',
  () => {
    const { rooms, office, breaks } = setup(agent(
      'idle',
      T0))
    const away = T0 + BREAK_AFTER_MS
    breaks.update(
      office,
      rooms,
      away)
    breaks.update(
      office,
      rooms,
      away + WALK_MS)
    breaks.recall(
      's:',
      away + WALK_MS)

    assert.equal(
      breaks
        .update(
          office,
          rooms,
          away + WALK_MS + WALK_MS / 2)
        .get('s:')?.isWalking,
      true)
    assert.equal(
      breaks
        .update(
          office,
          rooms,
          away + WALK_MS * 2)
        .size,
      0)
    assert.equal(
      breaks
        .update(
          office,
          rooms,
          away + WALK_MS + BREAK_AFTER_MS - 1)
        .size,
      0)
  })

test(
  'an agent that starts working again walks straight back',
  () => {
    const a = agent(
      'idle',
      T0)
    const { rooms, office, breaks } = setup(a)
    breaks.update(
      office,
      rooms,
      T0 + BREAK_AFTER_MS + WALK_MS)
    a.status = 'running'
    a.since = T0 + BREAK_AFTER_MS + WALK_MS

    assert.equal(
      breaks
        .update(
          office,
          rooms,
          T0 + BREAK_AFTER_MS + WALK_MS * 3)
        .get('s:')?.isWalking,
      true)
    assert.equal(
      breaks
        .update(
          office,
          rooms,
          T0 + BREAK_AFTER_MS + WALK_MS * 4)
        .size,
      0)
  })

test(
  'breaks are taken in the kitchen or the lounge',
  () => {
    const agents = Array.from(
      { length: 6 },
      (_, i) => ({ ...agent('idle', T0), id: i ? `h${i}` : null, name: `h${i}` }))
    const rooms = [{ ...room(agents[0]), agents }]
    const office = layoutOffice(
      rooms,
      640,
      400)
    const breaks = createBreaks()
    breaks.update(
      office,
      rooms,
      T0 + BREAK_AFTER_MS)
    const figures = [...breaks
      .update(
        office,
        rooms,
        T0 + BREAK_AFTER_MS + WALK_MS)
      .values()]
    const where = (kind: string) => figures.filter(f => {
      const r = office.rooms.find(r => r.kind === kind)!
      return f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.h
    }).length

    assert.equal(
      figures.length,
      6)
    assert.ok(where('kitchen') > 0)
    assert.ok(where('lounge') > 0)
    assert.equal(
      where('kitchen') + where('lounge'),
      6)
  })

test(
  'a recall says when the agent is back at its desk',
  () => {
    const { rooms, office, breaks } = setup(agent(
      'idle',
      T0))
    const away = T0 + BREAK_AFTER_MS
    breaks.update(
      office,
      rooms,
      away)
    breaks.update(
      office,
      rooms,
      away + WALK_MS)

    assert.equal(
      breaks.recall(
        's:',
        away + WALK_MS),
      away + WALK_MS * 2)
    assert.equal(
      breaks.recall(
        'nobody:',
        away),
      away)
  })
