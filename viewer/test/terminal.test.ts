import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { deskAt, fitScale, parseInput, roomAt, tooSmall } from '../terminal.ts'

const busy = () => JSON.parse(readFileSync(
  new URL(
    './fixtures/busy.json',
    import.meta.url),
  'utf8')) as RoomFile[]

test(
  'parses an SGR click and arrow keys',
  () => {
    assert.deepEqual(
      parseInput(Buffer.from('\x1b[<0;12;5M\x1b[A')),
      [{ kind: 'click', col: 12, row: 5 }, { kind: 'key', key: 'up' }])
  })

test(
  'parses enter, escape, tab and q',
  () => {
    assert.deepEqual(
      parseInput(Buffer.from('\r\x1b\tq')),
      [{ kind: 'key', key: 'enter' }, { kind: 'key', key: 'esc' }, { kind: 'key', key: 'tab' }, { kind: 'key', key: 'q' }])
  })

test(
  'ignores mouse releases',
  () => {
    assert.deepEqual(
      parseInput(Buffer.from('\x1b[<0;12;5m')),
      [])
  })

test(
  'layout follows a new size',
  () => {
    const small = fitScale(
      busy(),
      { cols: 100, rows: 40, cellW: 10, cellH: 20 })
    const large = fitScale(
      busy(),
      { cols: 200, rows: 60, cellW: 10, cellH: 20 })

    assert.notDeepEqual(
      [small.scale, small.office.width, small.office.height],
      [large.scale, large.office.width, large.office.height])
    assert.ok(small.office.width * small.scale <= 100 * 10)
    assert.ok(large.office.height * large.scale <= 60 * 20)
  })

test(
  'a click finds the desk under it',
  () => {
    const fit = fitScale(
      busy(),
      { cols: 200, rows: 60, cellW: 10, cellH: 20 })
    const desk = fit.office.desks[0]
    const px = (desk.x + desk.w / 2) * fit.scale
    const py = (desk.y + desk.h / 2) * fit.scale

    assert.deepEqual(
      deskAt(
        fit,
        { cols: 200, rows: 60, cellW: 10, cellH: 20 },
        Math.floor(px / 10) + 1,
        Math.floor(py / 20) + 1),
      desk)
  })

test(
  'tiny tab shows the bigger message',
  () => {
    assert.equal(
      tooSmall({ cols: 39, rows: 30 }),
      true)
    assert.equal(
      tooSmall({ cols: 80, rows: 24 }),
      false)
  })

test(
  "the terminal's own replies and unmapped keys are not Esc",
  () => {
    assert.deepEqual(
      parseInput(Buffer.from('\x1b[6;32;16t\x1b[3~\x1b[H\x1b[Z')),
      [])
  })

test(
  'an office too big for the tab shrinks evenly',
  () => {
    const many = Array.from(
      { length: 8 },
      (_, i) => ({ ...busy()[0], sessionId: `s${i}`, name: `s${i}` }))
    const size = { cols: 80, rows: 24, cellW: 8, cellH: 16 }
    const fit = fitScale(
      many,
      size)
    const shown = (fit.cols * size.cellW) / (fit.rows * size.cellH)
    const real = fit.office.width / fit.office.height

    assert.ok(Math.abs(shown - real) / real < 0.1)
  })

const tenRooms = () => {
  const base = busy()
  return Array.from(
    { length: 10 },
    (_, i) => ({ ...base[i % 3], sessionId: `s${i}`, name: `room-${i}` }))
}

test(
  'ten rooms fit a 120×35 tab without squashing',
  () => {
    const size = { cols: 120, rows: 35, cellW: 8, cellH: 16 }
    const fit = fitScale(
      tenRooms(),
      size)

    assert.ok(fit.office.width * fit.scale <= 120 * 8)
    assert.ok(fit.office.height * fit.scale <= 35 * 16)
  })

test(
  'ten rooms draw at 2× or more in a 220×55 retina tab',
  () => {
    const fit = fitScale(
      tenRooms(),
      { cols: 220, rows: 55, cellW: 16, cellH: 32 })

    assert.ok(fit.scale >= 2, `scale ${fit.scale}`)
  })

test(
  "a click anywhere in a session's room finds that room",
  () => {
    const size = { cols: 200, rows: 60, cellW: 10, cellH: 20 }
    const fit = fitScale(
      busy(),
      size)
    const room = fit.office.rooms.find(r => r.kind === 'session')!
    const corner = { x: room.x + 4, y: room.y + room.h - 4 }
    const lounge = fit.office.rooms.find(r => r.kind === 'lounge')!
    const cell = (p: { x: number; y: number }) => [Math.floor(p.x * fit.scale / 10) + 1, Math.floor(p.y * fit.scale / 20) + 1] as const

    assert.equal(
      roomAt(
        fit,
        size,
        ...cell(corner))?.sessionId,
      room.sessionId)
    assert.equal(
      roomAt(
        fit,
        size,
        ...cell({ x: lounge.x + 10, y: lounge.y + 30 })),
      undefined)
  })
