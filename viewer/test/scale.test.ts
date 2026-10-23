import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCanvas, fillRect, scaleCanvas } from '../canvas.ts'

test(
  'scaling copies each pixel into a whole block',
  () => {
    const c = createCanvas(
      2,
      1,
      [0, 0, 0])
    fillRect(
      c,
      1,
      0,
      1,
      1,
      [255, 0, 0])
    const s = scaleCanvas(
      c,
      3)

    assert.deepEqual(
      [s.width, s.height],
      [6, 3])
    assert.deepEqual(
      [...s.data.subarray(
        (2 * 6 + 5) * 4,
        (2 * 6 + 5) * 4 + 4)],
      [255, 0, 0, 255])
    assert.deepEqual(
      [...s.data.subarray(
        (2 * 6 + 2) * 4,
        (2 * 6 + 2) * 4 + 4)],
      [0, 0, 0, 255])
  })
