import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DeskAgent, RoomFile } from '../../mod/types/index.d.ts'
import { drawOffice, layoutOffice } from '../office.ts'
import { PALETTE } from '../sprites.ts'

const agent = (id: string | null, parentId: string | null = null, extra: Partial<DeskAgent> = {}): DeskAgent => ({
  id,
  parentId,
  name: id ?? 'main',
  type: id ? 'Explore' : 'main',
  description: '',
  status: 'running',
  needsYou: false,
  action: { icon: 'read', label: 'api.ts' },
  ...extra,
})

const room = (name: string, agents: DeskAgent[]): RoomFile => ({
  version: 1,
  sessionId: name,
  name,
  cwd: '/x',
  pid: 1,
  procStart: '',
  updatedAt: 0,
  agents,
  usage: [],
  log: [],
})

test(
  'seats helpers right after their parent',
  () => {
    const office = layoutOffice(
      [room(
        'a',
        [agent(null), agent('a2'), agent('a1'), agent(
          'a1b',
          'a1')])],
      320,
      200)

    assert.deepEqual(
      office.desks.map(d => d.agentId),
      [null, 'a2', 'a1', 'a1b'])
  })

test(
  'nested helpers follow their own parent, not the list order',
  () => {
    const office = layoutOffice(
      [room(
        'a',
        [agent(null), agent(
          'a1b',
          'a1'), agent('a2'), agent('a1')])],
      320,
      200)

    assert.deepEqual(
      office.desks.map(d => d.agentId),
      [null, 'a2', 'a1', 'a1b'])
  })

test(
  'fits 8 rooms and 13 desks',
  () => {
    const rooms = Array.from(
      { length: 8 },
      (_, i) => room(
        `r${i}`,
        i === 0
          ? [agent(null), ...Array.from(
            { length: 12 },
            (_, j) => agent(`h${j}`))]
          : [agent(null)]))
    const office = layoutOffice(
      rooms,
      640,
      400)
    const inside = (d: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      d.x >= b.x && d.y >= b.y && d.x + d.w <= b.x + b.w && d.y + d.h <= b.y + b.h

    assert.equal(
      office.desks.length,
      20)
    for (const d of office.desks) {
      assert.ok(inside(
        d,
        { x: 0, y: 0, w: office.width, h: office.height }))
      assert.ok(inside(
        d,
        office.rooms.find(r => r.kind === 'session' && r.sessionId === d.sessionId)!))
    }
    for (const a of office.desks)
      for (const b of office.desks)
        if (a !== b) assert.ok(
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
          'desks overlap')
  })

test(
  'an empty office still draws',
  () => {
    const office = layoutOffice(
      [],
      320,
      200)
    const canvas = drawOffice(
      office,
      [],
      0,
      null)

    assert.equal(
      office.rooms.filter(r => r.kind === 'empty').length,
      1)
    assert.deepEqual(
      [canvas.width, canvas.height],
      [office.width, office.height])
    assert.ok(office.width >= 320 && office.height >= 200)
  })

test(
  'needs you blinks',
  () => {
    const rooms = [room(
      'a',
      [agent(
        null,
        null,
        { needsYou: true, status: 'idle' })])]
    const office = layoutOffice(
      rooms,
      320,
      200)
    const at = (tick: number) => drawOffice(
      office,
      rooms,
      tick,
      null).data

    assert.notDeepEqual(
      at(0),
      at(5))
  })

test(
  'the sign sits above the rooms and the board below them',
  () => {
    const office = layoutOffice(
      [room(
        'a',
        [agent(null)])],
      640,
      400)

    for (const r of office.rooms) {
      assert.ok(office.sign.y + office.sign.h <= r.y)
      assert.ok(office.board.y >= r.y + r.h)
    }
    assert.ok(office.board.y + office.board.h <= office.height)
  })

test(
  'the header and log are drawn on the sign and the board',
  () => {
    const rooms = [room(
      'a',
      [agent(null)])]
    const office = layoutOffice(
      rooms,
      640,
      400)
    const draw = (header: string, line: string) => drawOffice(
      office,
      rooms,
      0,
      null,
      { header, title: 'ACTIVITY', lines: [{ icon: 'bash', text: line }], hint: '' })
    const inBox = (a: Uint8Array, b: Uint8Array, box: { x: number; y: number; w: number; h: number }) => {
      for (let y = box.y; y < box.y + box.h; y++)
        for (let x = box.x; x < box.x + box.w; x++)
          if (a[(y * office.width + x) * 4] !== b[(y * office.width + x) * 4]) return true
      return false
    }

    assert.ok(inBox(
      draw(
        'A',
        'x').data,
      draw(
        'B',
        'x').data,
      office.sign))
    assert.ok(inBox(
      draw(
        'A',
        'x').data,
      draw(
        'A',
        'y').data,
      office.board))
  })

test(
  'subagents are drawn as interns and main is not',
  () => {
    const rooms = [room(
      'a',
      [agent(null), agent('a1')])]
    const office = layoutOffice(
      rooms,
      640,
      400)
    const c = drawOffice(
      office,
      rooms,
      0,
      null)
    const has = (d: { x: number; y: number; w: number; h: number }, [r, g, b]: number[]) => {
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) {
          const i = (y * c.width + x) * 4
          if (c.data[i] === r && c.data[i + 1] === g && c.data[i + 2] === b) return true
        }
      return false
    }

    assert.equal(
      has(
        office.desks[1],
        PALETTE.intern),
      true)
    assert.equal(
      has(
        office.desks[0],
        PALETTE.intern),
      false)
  })
