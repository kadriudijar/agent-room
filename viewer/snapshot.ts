#!/usr/bin/env node
// Renders a fixture of rooms to a PNG, with the art and the breaks as claude-room draws them:
// node viewer/snapshot.ts <fixture.json> <out.png> [width height]: the image's size in pixels, filled
// as claude-room fills a tab of that size (whole-number scale).
// A desk agent without `since` is taken to have changed status just now; `since: 0` has waited long
// enough to be on a break.
import { readFileSync, writeFileSync } from 'node:fs'
import type { RoomFile } from '../mod/types/index.d.ts'
import { loadArt } from './art.ts'
import { createBreaks, WALK_MS } from './breaks.ts'
import { BIG_W, scaleCanvas } from './canvas.ts'
import { BOARD_LINES, drawOffice } from './office.ts'
import { encodePng } from './png.ts'
import { fitScale } from './terminal.ts'
import { headerLine, logLines } from './text.ts'

if (import.meta.main) {
  const [fixture, out, width = '1920', height = '1080'] = process.argv.slice(2)
  const now = Date.now()
  const rooms = JSON.parse(readFileSync(
    fixture,
    'utf8')) as RoomFile[]
  for (const room of rooms)
    for (const agent of room.agents) agent.since ??= now
  // A tab of 8×16 cells the image's size.
  const { office, scale } = fitScale(
    rooms,
    { cols: Math.floor(Number(width) / 8), rows: Math.floor(Number(height) / 16), cellW: 8, cellH: 16 })
  const breaks = createBreaks()
  breaks.update(
    office,
    rooms,
    now)
  const figures = breaks.update(
    office,
    rooms,
    now + WALK_MS)
  const cols = Math.floor((office.sign.w - 16) / BIG_W)
  writeFileSync(
    out,
    encodePng(scaleCanvas(
      drawOffice(
        office,
        rooms,
        0,
        null,
        {
          header: headerLine(
            rooms,
            now,
            cols),
          title: 'Activity',
          lines: logLines(
            rooms,
            BOARD_LINES,
            cols),
          hint: 'Click a room to open its terminal · Tab: details · q: quit',
        },
        figures,
        loadArt(new URL(
          '../art',
          import.meta.url).pathname)),
      scale)))
}
