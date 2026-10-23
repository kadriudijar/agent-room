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
      { cols: 100, rows: 40, cellW: 10, cellH: 20 },
      33)
    const large = fitScale(
      busy(),
      { cols: 200, rows: 60, cellW: 10, cellH: 20 },
      53)

    assert.notDeepEqual(
      [small.scale, small.office.width, small.office.height],
      [large.scale, large.office.width, large.office.height])
    assert.ok(small.office.width * small.scale <= 100 * 10)
    assert.ok(large.office.height * large.scale <= 53 * 20)
  })

test(
  'a click finds the desk under it',
  () => {
    const fit = fitScale(
      busy(),
      { cols: 200, rows: 60, cellW: 10, cellH: 20 },
      53)
    const desk = fit.office.desks[0]
    const px = (desk.x + desk.w / 2) * fit.scale
    const py = (desk.y + desk.h / 2) * fit.scale

    assert.deepEqual(
      deskAt(
        fit,
        { cols: 200, rows: 60, cellW: 10, cellH: 20 },
        Math.floor(px / 10) + 1,
        Math.floor(py / 20) + 2),
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
