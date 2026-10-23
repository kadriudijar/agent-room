import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createCanvas, fillRect } from '../canvas.ts'
import { decodePng } from '../png.ts'
import { cut, findSprites, keyGreen, recolor, shrink } from '../sheet.ts'

const sheet = (name: string) => keyGreen(decodePng(readFileSync(new URL(
  `../../art/${name}.png`,
  import.meta.url))))

test(
  'green is keyed out and plant green is kept',
  () => {
    const c = createCanvas(
      2,
      1,
      [20, 240, 10])
    fillRect(
      c,
      1,
      0,
      1,
      1,
      [72, 150, 72])
    keyGreen(c)

    assert.equal(
      c.data[3],
      0)
    assert.equal(
      c.data[7],
      255)
  })

test(
  'sprites are found in reading order',
  () => {
    const c = createCanvas(
      100,
      60,
      [0, 255, 0])
    fillRect(
      c,
      60,
      5,
      20,
      20,
      [200, 0, 0])
    fillRect(
      c,
      5,
      8,
      20,
      20,
      [0, 0, 200])
    fillRect(
      c,
      30,
      40,
      14,
      14,
      [0, 0, 0])
    const boxes = findSprites(keyGreen(c))

    assert.deepEqual(
      boxes.map(b => b.x),
      [5, 60, 30])
  })

for (const [name, count] of [['boss', 28], ['interns', 28], ['desks', 10], ['tiles', 16], ['breakroom', 15], ['ui', 7]] as const)
  test(
    `${name}.png holds ${count} sprites`,
    () => {
      assert.equal(
        findSprites(sheet(name)).length,
        count)
    })

test(
  'shrinking keeps hard pixels and the shape',
  () => {
    const c = createCanvas(
      16,
      16,
      [0, 255, 0])
    fillRect(
      c,
      4,
      4,
      8,
      8,
      [200, 0, 0])
    keyGreen(c)
    const small = shrink(
      cut(
        c,
        { x: 0, y: 0, w: 16, h: 16 }),
      4,
      4)
    const alpha = (x: number, y: number) => small.data[(y * small.width + x) * 4 + 3]

    assert.deepEqual(
      [small.width, small.height],
      [4, 4])
    assert.equal(
      alpha(
        1,
        1),
      255)
    assert.equal(
      alpha(
        0,
        0),
      0)
    assert.equal(
      small.data[(1 * 4 + 1) * 4],
      200)
  })

test(
  'a wide sprite keeps its aspect when shrunk into a square',
  () => {
    const small = shrink(
      createCanvas(
        40,
        10,
        [1, 2, 3]),
      8,
      8)

    assert.deepEqual(
      [small.width, small.height],
      [8, 2])
  })

test(
  "only the magenta shirt takes the agent's colour",
  () => {
    const c = createCanvas(
      2,
      1,
      [240, 20, 230])
    fillRect(
      c,
      1,
      0,
      1,
      1,
      [240, 196, 156])
    const shirt = recolor(
      c,
      [90, 130, 210])

    assert.ok(shirt.data[2] > shirt.data[0])
    assert.deepEqual(
      [...shirt.data.subarray(
        4,
        7)],
      [240, 196, 156])
  })

test(
  'icon pieces close together merge into one sprite',
  () => {
    assert.equal(
      findSprites(
        sheet('icons'),
        { across: 16, down: 48 }).length,
      9)
  })
