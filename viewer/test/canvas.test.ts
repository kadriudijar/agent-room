import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCanvas, drawSprite, drawText } from '../canvas.ts'
import { encodePng } from '../png.ts'
import { sprite, SPRITES } from '../sprites.ts'

const pixel = (c: { width: number; data: Uint8Array }, x: number, y: number) => [...c.data.subarray(
  (y * c.width + x) * 4,
  (y * c.width + x) * 4 + 4)]

test(
  'encodes a valid PNG',
  () => {
    const png = encodePng(createCanvas(
      3,
      2))
    const file = join(
      mkdtempSync(join(
        tmpdir(),
        'png-')),
      'a.png')
    writeFileSync(
      file,
      png)
    const info = execFileSync(
      'sips',
      ['-g', 'pixelWidth', '-g', 'pixelHeight', file])
      .toString()

    assert.deepEqual(
      [...png.subarray(
        0,
        8)],
      [137, 80, 78, 71, 13, 10, 26, 10])
    assert.match(
      info,
      /pixelWidth: 3/)
    assert.match(
      info,
      /pixelHeight: 2/)
  })

test(
  'draws a sprite with transparency',
  () => {
    const c = createCanvas(
      2,
      1,
      [0, 0, 0])
    drawSprite(
      c,
      sprite(
        ['a.'],
        { a: 'white' }),
      0,
      0)

    assert.deepEqual(
      pixel(
        c,
        1,
        0),
      [0, 0, 0, 255])
    assert.notDeepEqual(
      pixel(
        c,
        0,
        0),
      [0, 0, 0, 255])
  })

test(
  'every sprite row matches its width',
  () => {
    const all = (value: unknown, path: string): void => {
      if (value && typeof value === 'object' && 'px' in value) {
        const s = value as { w: number; h: number; px: unknown[] }
        assert.equal(
          s.px.length,
          s.w * s.h,
          path)
        return
      }
      if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value)) all(
          child,
          `${path}.${key}`)
    }
    all(
      SPRITES,
      'SPRITES')
  })

test(
  'unknown glyphs draw as ?',
  () => {
    const a = createCanvas(
      8,
      8,
      [0, 0, 0])
    const b = createCanvas(
      8,
      8,
      [0, 0, 0])
    drawText(
      a,
      'é',
      0,
      0,
      [255, 255, 255])
    drawText(
      b,
      '?',
      0,
      0,
      [255, 255, 255])

    assert.deepEqual(
      a.data,
      b.data)
    assert.ok(a.data.some((v, i) => i % 4 === 0 && v === 255))
  })
