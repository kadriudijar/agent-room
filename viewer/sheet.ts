import type { Canvas } from './canvas.ts'
import type { Rgb } from './sprites.ts'
import type { Box } from './office.ts'

// The generator's background is pure green and its shadows a darker green; plants are a muted,
// darker green with red and blue in them, so they survive.
const isBackground = (r: number, g: number, b: number) => g > 150 && r < 100 && b < 100 && g - Math.max(r, b) > 90

export const keyGreen = (c: Canvas) => {
  for (let i = 0; i < c.data.length; i += 4)
    if (isBackground(c.data[i], c.data[i + 1], c.data[i + 2])) c.data[i + 3] = 0
  return c
}

const BLOCK = 4
const MIN_AREA = 12 * 12

// The exact opaque bounds inside a block-aligned box.
const tighten = (c: Canvas, x0: number, y0: number, x1: number, y1: number): Box => {
  let minX = x1
  let minY = y1
  let maxX = x0
  let maxY = y0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (c.data[(y * c.width + x) * 4 + 3]) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

// Each separate blob of opaque pixels, as boxes in reading order: rows top to bottom, then left to right.
export type Merge = { across: number; down: number }

export const findSprites = (c: Canvas, merge: Merge = { across: 0, down: 0 }): Box[] => {
  const w = Math.ceil(c.width / BLOCK)
  const h = Math.ceil(c.height / BLOCK)
  // A block counts as opaque when any pixel in it is, so thin outlines keep a sprite in one piece.
  const solid = new Uint8Array(w * h)
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (c.data[(y * c.width + x) * 4 + 3]) solid[Math.floor(y / BLOCK) * w + Math.floor(x / BLOCK)] = 1
  const seen = new Uint8Array(w * h)
  const boxes: Box[] = []
  for (let start = 0; start < w * h; start++) {
    if (!solid[start] || seen[start]) continue
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const at = stack.pop()!
      const x = at % w
      const y = Math.floor(at / w)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx
        const ny = y + dy
        const next = ny * w + nx
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[next] && !seen[next]) {
          seen[next] = 1
          stack.push(next)
        }
      }
    }
    const box = tighten(
      c,
      minX * BLOCK,
      minY * BLOCK,
      Math.min(c.width, (maxX + 1) * BLOCK),
      Math.min(c.height, (maxY + 1) * BLOCK))
    if (box.w * box.h >= MIN_AREA) boxes.push(box)
  }
  // Pieces of one drawing become one box: stacked pieces (a `?` and its dot, steam over a cup) up to
  // `down` apart, side-by-side ones (a pair of heads) up to `across` apart.
  const touches = (a: Box, b: Box) => {
    const overlapX = a.x < b.x + b.w && b.x < a.x + a.w
    const overlapY = a.y < b.y + b.h && b.y < a.y + a.h
    const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
    const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
    return (overlapX && gapY <= merge.down) || (overlapY && gapX <= merge.across)
  }
  for (let merged = merge.across > 0 || merge.down > 0; merged;) {
    merged = false
    for (let i = 0; i < boxes.length && !merged; i++)
      for (let j = i + 1; j < boxes.length && !merged; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (touches(
          a,
          b)) {
          const x = Math.min(a.x, b.x)
          const y = Math.min(a.y, b.y)
          boxes[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
          boxes.splice(j, 1)
          merged = true
        }
      }
  }
  // Rows: a box joins the row whose vertical span overlaps its centre.
  const rows: Box[][] = []
  for (const box of [...boxes].sort((a, b) => a.y - b.y)) {
    const centre = box.y + box.h / 2
    const row = rows.find(r => r.some(o => centre >= o.y && centre < o.y + o.h))
    if (row) row.push(box)
    else rows.push([box])
  }
  return rows.flatMap(row => row.sort((a, b) => a.x - b.x))
}

export const cut = (c: Canvas, box: Box): Canvas => {
  const out = { width: box.w, height: box.h, data: new Uint8Array(box.w * box.h * 4) }
  for (let y = 0; y < box.h; y++) out.data.set(
    c.data.subarray(
      ((box.y + y) * c.width + box.x) * 4,
      ((box.y + y) * c.width + box.x + box.w) * 4),
    y * box.w * 4)
  return out
}

// Fits inside maxW × maxH keeping the aspect. Each pixel averages the opaque pixels it covers and is
// opaque when at least half its area was, so edges stay hard.
export const shrink = (c: Canvas, maxW: number, maxH: number): Canvas => {
  const k = Math.min(
    maxW / c.width,
    maxH / c.height)
  const width = Math.max(
    1,
    Math.round(c.width * k))
  const height = Math.max(
    1,
    Math.round(c.height * k))
  const out = { width, height, data: new Uint8Array(width * height * 4) }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * c.width / width)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * c.width / width))
      const y0 = Math.floor(y * c.height / height)
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * c.height / height))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * c.width + xx) * 4
          if (!c.data[i + 3]) continue
          r += c.data[i]
          g += c.data[i + 1]
          b += c.data[i + 2]
          n++
        }
      if (n * 2 < (x1 - x0) * (y1 - y0)) continue
      out.data.set(
        [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255],
        (y * width + x) * 4)
    }
  return out
}

// The shirt is drawn magenta so it can be recoloured: magenta pixels take `rgb`, keeping their shading.
export const recolor = (c: Canvas, rgb: Rgb): Canvas => {
  const out = { ...c, data: new Uint8Array(c.data) }
  for (let i = 0; i < out.data.length; i += 4) {
    const [r, g, b] = [out.data[i], out.data[i + 1], out.data[i + 2]]
    if (r < 120 || b < 100 || g > Math.min(r, b) * 0.6) continue
    const light = (r + b) / 2 / 240
    out.data[i] = Math.min(255, Math.round(rgb[0] * light))
    out.data[i + 1] = Math.min(255, Math.round(rgb[1] * light))
    out.data[i + 2] = Math.min(255, Math.round(rgb[2] * light))
  }
  return out
}
