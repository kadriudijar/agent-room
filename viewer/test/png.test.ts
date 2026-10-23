import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createCanvas, fillRect } from '../canvas.ts'
import { decodePng, encodePng } from '../png.ts'

test(
  'a PNG decodes back to the pixels it was made from',
  () => {
    const c = createCanvas(
      5,
      3,
      [10, 20, 30])
    fillRect(
      c,
      1,
      1,
      2,
      1,
      [200, 100, 50])
    const back = decodePng(encodePng(c))

    assert.deepEqual(
      [back.width, back.height],
      [5, 3])
    assert.deepEqual(
      back.data,
      c.data)
  })

test(
  'an RGB art sheet decodes at its size, opaque',
  () => {
    const sheet = decodePng(readFileSync(new URL(
      '../../art/ui.png',
      import.meta.url)))

    assert.deepEqual(
      [sheet.width, sheet.height],
      [2172, 724])
    assert.equal(
      sheet.data[3],
      255)
  })
