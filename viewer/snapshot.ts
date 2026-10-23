#!/usr/bin/env node
// Renders a fixture of rooms to a PNG: node viewer/snapshot.ts <fixture.json> <out.png> [width height] [scale]
import { readFileSync, writeFileSync } from 'node:fs'
import type { RoomFile } from '../mod/types/index.d.ts'
import { type Canvas } from './canvas.ts'
import { drawOffice, layoutOffice } from './office.ts'
import { encodePng } from './png.ts'

export const scaleCanvas = (c: Canvas, scale: number): Canvas => {
  if (scale === 1) return c
  const out = { width: c.width * scale, height: c.height * scale, data: new Uint8Array(c.width * scale * c.height * scale * 4) }
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) out.data.set(
      c.data.subarray(
        ((Math.floor(y / scale) * c.width) + Math.floor(x / scale)) * 4,
        ((Math.floor(y / scale) * c.width) + Math.floor(x / scale)) * 4 + 4),
      (y * out.width + x) * 4)
  return out
}

if (import.meta.main) {
  const [fixture, out, width = '640', height = '400', scale = '2'] = process.argv.slice(2)
  const rooms = JSON.parse(readFileSync(
    fixture,
    'utf8')) as RoomFile[]
  const office = layoutOffice(
    rooms,
    Number(width),
    Number(height))
  writeFileSync(
    out,
    encodePng(scaleCanvas(
      drawOffice(
        office,
        rooms,
        0,
        office.desks[1] ?? null),
      Number(scale))))
}
