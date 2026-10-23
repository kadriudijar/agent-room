import type { DeskAgent, RoomFile } from '../mod/types/index.d.ts'
import { type Canvas, createCanvas, drawSprite, drawText, fillRect, GLYPH_W } from './canvas.ts'
import { PALETTE, SPRITES, type Sprite } from './sprites.ts'

export type Box = { x: number; y: number; w: number; h: number }
export type Desk = Box & { sessionId: string; agentId: string | null }
export type RoomBox = Box & { sessionId: string }
export type Office = { width: number; height: number; rooms: RoomBox[]; desks: Desk[] }

const DESK_W = 64
const DESK_H = 56
const WALL_H = 16
const PAD = 8
const CORRIDOR = 16
const MARGIN = 16

// Depth first from main: each agent's helpers sit right after it.
const seating = (agents: DeskAgent[]) => {
  const ids = new Set(agents.map(a => a.id))
  const childrenOf = (parent: string | null) => agents.filter(a =>
    a.id !== null &&
    (a.parentId === parent || (parent === null && !ids.has(a.parentId))))
  const order: DeskAgent[] = []
  const visit = (a: DeskAgent) => {
    order.push(a)
    for (const child of childrenOf(a.id)) visit(child)
  }
  const main = agents.find(a => a.id === null)
  if (main) visit(main)
  for (const a of agents)
    if (!order.includes(a)) order.push(a)
  return order
}

const roomSize = (desks: number, deskCols: number) => ({
  w: PAD * 2 + Math.max(1, Math.min(deskCols, desks)) * DESK_W,
  h: WALL_H + PAD * 2 + Math.max(1, Math.ceil(desks / deskCols)) * DESK_H,
})

export const layoutOffice = (rooms: RoomFile[], width: number, height: number): Office => {
  // With no sessions, one empty room holds the sign.
  const shown = rooms.length ? rooms : [{ sessionId: '', agents: [] as DeskAgent[] }]
  const roomCols = Math.ceil(Math.sqrt(shown.length))
  const roomRows = Math.ceil(shown.length / roomCols)
  const most = Math.max(3, ...shown.map(r => r.agents.length))

  const sizeFor = (deskCols: number) => {
    const sizes = shown.map(r => roomSize(
      r.agents.length || 3,
      deskCols))
    const colW = Array.from(
      { length: roomCols },
      (_, c) => Math.max(...sizes.filter((_, i) => i % roomCols === c).map(s => s.w)))
    const rowH = Array.from(
      { length: roomRows },
      (_, r) => Math.max(...sizes.filter((_, i) => Math.floor(i / roomCols) === r).map(s => s.h)))
    return {
      colW,
      rowH,
      w: MARGIN * 2 + colW.reduce((a, b) => a + b, 0) + CORRIDOR * (roomCols - 1),
      h: MARGIN * 2 + rowH.reduce((a, b) => a + b, 0) + CORRIDOR * (roomRows - 1),
    }
  }

  // The desks per row whose office shape is closest to the screen's.
  const target = width / height
  let deskCols = 1
  for (let cols = 1; cols <= most; cols++) {
    const a = sizeFor(cols)
    const b = sizeFor(deskCols)
    if (Math.abs(Math.log(a.w / a.h / target)) < Math.abs(Math.log(b.w / b.h / target))) deskCols = cols
  }
  const size = sizeFor(deskCols)
  const officeW = Math.max(
    width,
    size.w)
  const officeH = Math.max(
    height,
    size.h)
  const offsetX = Math.floor((officeW - size.w) / 2)
  const offsetY = Math.floor((officeH - size.h) / 2)

  const boxes: RoomBox[] = []
  const desks: Desk[] = []
  shown.forEach((r, i) => {
    const col = i % roomCols
    const row = Math.floor(i / roomCols)
    const x = offsetX + MARGIN + size.colW
      .slice(
        0,
        col)
      .reduce((a, b) => a + b + CORRIDOR, 0)
    const y = offsetY + MARGIN + size.rowH
      .slice(
        0,
        row)
      .reduce((a, b) => a + b + CORRIDOR, 0)
    boxes.push({ sessionId: r.sessionId, x, y, w: size.colW[col], h: size.rowH[row] })
    seating(r.agents).forEach((a, d) => desks.push({
      sessionId: r.sessionId,
      agentId: a.id,
      x: x + PAD + (d % deskCols) * DESK_W,
      y: y + WALL_H + PAD + Math.floor(d / deskCols) * DESK_H,
      w: DESK_W,
      h: DESK_H,
    }))
  })
  return { width: officeW, height: officeH, rooms: boxes, desks }
}

const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

// A well-mixed integer per grid cell, so trees and tufts don't clump.
const scatter = (x: number, y: number) => {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  return (h ^ (h >>> 13)) >>> 0
}

const tile = (c: Canvas, s: Sprite, box: Box) => {
  for (let y = box.y; y < box.y + box.h; y += s.h)
    for (let x = box.x; x < box.x + box.w; x += s.w) drawSprite(
      c,
      s,
      x,
      y,
      {},
      box)
}

const outlineRect = (c: Canvas, { x, y, w, h }: Box, rgb: [number, number, number]) => {
  fillRect(
    c,
    x,
    y,
    w,
    1,
    rgb)
  fillRect(
    c,
    x,
    y + h - 1,
    w,
    1,
    rgb)
  fillRect(
    c,
    x,
    y,
    1,
    h,
    rgb)
  fillRect(
    c,
    x + w - 1,
    y,
    1,
    h,
    rgb)
}

// Cuts text to what fits in `width` px of the pixel font, ending with `…`.
const fit = (text: string, width: number) => {
  const max = Math.floor(width / GLYPH_W)
  return text.length <= max ? text : `${text.slice(
    0,
    Math.max(
      0,
      max - 1))}…`
}

const drawRoom = (c: Canvas, box: RoomBox, room: RoomFile | undefined) => {
  // Shadow, floor, walls.
  fillRect(
    c,
    box.x + 3,
    box.y + 3,
    box.w,
    box.h,
    PALETTE.grassDark)
  tile(
    c,
    hash(box.sessionId) % 2 ? SPRITES.floorTile : SPRITES.floorWood,
    { ...box, y: box.y + WALL_H, h: box.h - WALL_H })
  tile(
    c,
    SPRITES.wallTop,
    { ...box, h: WALL_H })
  outlineRect(
    c,
    box,
    PALETTE.outline)
  if (box.w >= 120) drawSprite(
    c,
    SPRITES.window,
    box.x + box.w - 24,
    box.y + 2)
  drawSprite(
    c,
    SPRITES.plant,
    box.x + box.w - 12,
    box.y + box.h - 16)
  if (!room) {
    const sx = box.x + Math.floor((box.w - SPRITES.sign.w) / 2)
    const sy = box.y + WALL_H + PAD + 8
    drawSprite(
      c,
      SPRITES.sign,
      sx,
      sy)
    drawText(
      c,
      'NO SESSIONS',
      sx + 1,
      sy + 3,
      PALETTE.outline)
    return
  }
  drawText(
    c,
    fit(
      room.name,
      box.w - 40),
    box.x + 6,
    box.y + 5,
    PALETTE.white)
}

const drawBubble = (c: Canvas, desk: Desk, agent: DeskAgent) => {
  if (!agent.action) return
  const label = fit(
    agent.action.label,
    DESK_W - 15)
  const w = Math.min(
    DESK_W - 2,
    12 + label.length * GLYPH_W)
  const x = desk.x + Math.floor((DESK_W - w) / 2)
  const y = desk.y
  fillRect(
    c,
    x,
    y,
    w,
    11,
    PALETTE.outline)
  fillRect(
    c,
    x + 1,
    y + 1,
    w - 2,
    9,
    PALETTE.white)
  drawSprite(
    c,
    SPRITES.bubble.tail,
    desk.x + DESK_W / 2 - 2,
    y + 10)
  drawSprite(
    c,
    SPRITES.icons[agent.action.icon],
    x + 2,
    y + 2)
  drawText(
    c,
    label,
    x + 11,
    y + 3,
    PALETTE.outline)
}

const drawDesk = (c: Canvas, desk: Desk, agent: DeskAgent, tick: number, isSelected: boolean) => {
  const shirt = hash(agent.id ?? desk.sessionId) % 6
  const recolor = { body: `shirt${shirt}`, bodyDark: `shirt${shirt}d` }
  const cx = desk.x + DESK_W / 2
  const isRunning = agent.status === 'running'
  const monitor = agent.needsYou
    ? SPRITES.monitorAlert
    : isRunning ? SPRITES.monitorOn[Math.floor(tick / 4) % 2] : SPRITES.monitorOff
  const person = isRunning
    ? SPRITES.person.type[Math.floor(tick / 2) % 2]
    : agent.status === 'idle' ? SPRITES.person.lean : SPRITES.person.sit

  if (isSelected) outlineRect(
    c,
    desk,
    PALETTE.select)
  drawSprite(
    c,
    monitor,
    cx - 7,
    desk.y + 15)
  drawSprite(
    c,
    SPRITES.desk,
    cx - 14,
    desk.y + 25)
  drawSprite(
    c,
    person,
    cx - 5,
    desk.y + 27,
    recolor)
  if (agent.id === null) drawSprite(
    c,
    SPRITES.crown,
    cx - 2,
    desk.y + 25)
  else drawSprite(
    c,
    SPRITES.cap,
    cx - 3,
    desk.y + 27)
  drawSprite(
    c,
    SPRITES.chair,
    cx - 7,
    desk.y + 40)
  drawText(
    c,
    fit(
      agent.name,
      DESK_W - 2),
    cx - Math.floor(fit(
      agent.name,
      DESK_W - 2).length * GLYPH_W / 2),
    desk.y + 50,
    PALETTE.outline)
  drawBubble(
    c,
    desk,
    agent)
  // Blinks on for half a second, off for half a second (10 frames a second).
  if (agent.needsYou && Math.floor(tick / 5) % 2 === 0) drawSprite(
    c,
    SPRITES.alert,
    cx + 9,
    desk.y + 14)
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w &&
  b.x < a.x + a.w &&
  a.y < b.y + b.h &&
  b.y < a.y + a.h

// Grass tufts and trees on a fixed grid, kept off the rooms and their shadows.
const drawGrounds = (c: Canvas, office: Office) => {
  const blocked = office.rooms.map(r => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }))
  for (let y = 0; y < office.height; y += 12)
    for (let x = 0; x < office.width; x += 12) {
      const h = scatter(
        x,
        y)
      const tree = { x: x + (h % 5), y: y + ((h >> 3) % 5), w: SPRITES.tree.w, h: SPRITES.tree.h }
      if (h % 11 === 0 && !blocked.some(b => overlaps(
        tree,
        b))) drawSprite(
        c,
        SPRITES.tree,
        tree.x,
        tree.y)
      else if (h % 3 === 0 && !blocked.some(b => overlaps(
        { ...tree, w: 3, h: 2 },
        b))) drawSprite(
        c,
        SPRITES.tuft,
        tree.x,
        tree.y)
    }
}

export const drawOffice = (office: Office, rooms: RoomFile[], tick: number, selected: Desk | null): Canvas => {
  const c = createCanvas(
    office.width,
    office.height)
  drawGrounds(
    c,
    office)
  for (const box of office.rooms) drawRoom(
    c,
    box,
    rooms.find(r => r.sessionId === box.sessionId))
  for (const desk of office.desks) {
    const agent = rooms
      .find(r => r.sessionId === desk.sessionId)
      ?.agents.find(a => a.id === desk.agentId)
    if (agent) drawDesk(
      c,
      desk,
      agent,
      tick,
      selected?.sessionId === desk.sessionId && selected.agentId === desk.agentId)
  }
  return c
}
