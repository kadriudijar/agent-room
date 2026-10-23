import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { deskAt, fitScale, parseInput, tooSmall } from '../terminal.ts'

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
