import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { loadArt } from '../art.ts'
import { drawOffice, layoutOffice } from '../office.ts'

const ART = new URL(
  '../../art',
  import.meta.url).pathname
const art = loadArt(ART)!
const busy = () => JSON.parse(readFileSync(
  new URL(
    './fixtures/busy.json',
    import.meta.url),
  'utf8')) as RoomFile[]

test(
  'the art folder loads into sprites at their office sizes',
  () => {
    assert.ok(art)
    assert.equal(
      art.boss.length,
      4)
    assert.equal(
      art.interns.length,
      4)
    for (const look of [...art.boss, ...art.interns]) {
      assert.equal(
        look.seated.length,
        4)
      assert.equal(
        look.walk.length,
        2)
      for (const frame of [...look.seated, look.stand, ...look.walk]) assert.ok(frame.width <= 44 && frame.height <= 38)
    }
    for (const floor of Object.values(art.floors)) {
      assert.equal(
        floor.width,
        floor.height)
      assert.ok(floor.width <= 16)
    }
    assert.ok(art.window.width >= 18)
    for (const icon of Object.values(art.icons)) assert.ok(icon.width <= 7 && icon.height <= 7)
  })

test(
  'no art folder means the drawn-in-code look',
  () => {
    assert.equal(
      loadArt('/nonexistent/art'),
      undefined)
  })

test(
  'the office draws with the art',
  () => {
    const rooms = busy()
    const office = layoutOffice(
      rooms,
      640,
      400)
    const plain = drawOffice(
      office,
      rooms,
      0,
      null)
    const painted = drawOffice(
      office,
      rooms,
      0,
      null,
      undefined,
      new Map(),
      art)

    assert.deepEqual(
      [painted.width, painted.height],
      [plain.width, plain.height])
    assert.notDeepEqual(
      painted.data,
      plain.data)
  })
