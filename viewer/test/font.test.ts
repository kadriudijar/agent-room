import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCanvas, drawText } from '../canvas.ts'
import { BIG_FONT } from '../font.ts'

const draw = (text: string) => {
  const c = createCanvas(
    40,
    12,
    [0, 0, 0])
  drawText(
    c,
    text,
    0,
    0,
    [255, 255, 255],
    'big')
  return c.data
}

test(
  'every big glyph is 5 wide and 9 tall',
  () => {
    for (const [ch, rows] of Object.entries(BIG_FONT)) {
      assert.equal(
        rows.length,
        9,
        ch)
      for (const row of rows) assert.equal(
        row.length,
        5,
        ch)
    }
  })

test(
  'the big font covers printable ASCII',
  () => {
    for (let code = 32; code < 127; code++) assert.ok(
      BIG_FONT[String.fromCharCode(code)],
      String.fromCharCode(code))
  })

test(
  'the big font keeps lower case',
  () => {
    assert.notDeepEqual(
      draw('a'),
      draw('A'))
  })

test(
  'a glyph the big font lacks draws as ?',
  () => {
    assert.deepEqual(
      draw('é'),
      draw('?'))
  })
