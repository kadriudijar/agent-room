#!/usr/bin/env node
// Renders a fixture of rooms to a PNG: node viewer/snapshot.ts <fixture.json> <out.png> [width height] [scale]
import { readFileSync, writeFileSync } from 'node:fs'
import type { RoomFile } from '../mod/types/index.d.ts'
import { scaleCanvas } from './canvas.ts'
import { BOARD_LINES, drawOffice, layoutOffice } from './office.ts'
import { headerLine, logLines } from './text.ts'
import { encodePng } from './png.ts'

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
        office.desks[1] ?? null,
        {
          header: headerLine(
            rooms,
            Date.now(),
            Math.floor(office.width / 6)),
          title: 'Activity',
          lines: logLines(
            rooms,
            BOARD_LINES,
            Math.floor(office.width / 6)),
          hint: 'Click a room to open its terminal · Tab: details · q: quit',
        }),
      Number(scale))))
}
