import type { DeskAgent, RoomFile } from '../mod/types/index.d.ts'
import { type Canvas, createCanvas, drawSprite, drawText, fillRect, GLYPH_H, GLYPH_W } from './canvas.ts'
import { PALETTE, type Rgb, SPRITES, type Sprite } from './sprites.ts'
import { agentKey, type Figure } from './breaks.ts'
import type { Line } from './text.ts'

export type Box = { x: number; y: number; w: number; h: number }
export type Desk = Box & { sessionId: string; agentId: string | null }
// `session` holds a session's desks; `empty` the no-sessions sign; the rest are shared rooms.
export type RoomKind = 'session' | 'empty' | 'lounge' | 'kitchen'
export type RoomBox = Box & { sessionId: string; kind: RoomKind }
export type Office = { width: number; height: number; rooms: RoomBox[]; desks: Desk[]; building: Box; sign: Box; board: Box }
// What the sign and the board show: the status line, and the log or a desk's details.
export type Hud = { header: string; title: string; lines: Line[]; hint: string; isPaper?: boolean }

const DESK_W = 64
const DESK_H = 56
const WALL_H = 16
const PAD = 8
const CORRIDOR = 16
const OUTER_WALL = 16
const SIDE_WALL = 6
const MARGIN = 4
const SIGN_H = 17
export const BOARD_LINES = 6
const LINE_H = GLYPH_H + 2
const BOARD_H = 14 + BOARD_LINES * LINE_H
const COMMONS: RoomKind[] = ['lounge', 'kitchen']

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

type Cell = { sessionId: string; kind: RoomKind; agents: DeskAgent[] }

export const layoutOffice = (rooms: RoomFile[], width: number, height: number): Office => {
  const cells: Cell[] = [
    ...(rooms.length
      ? rooms.map(r => ({ sessionId: r.sessionId, kind: 'session' as const, agents: r.agents }))
      : [{ sessionId: '', kind: 'empty' as const, agents: [] }]),
    ...COMMONS.map(kind => ({ sessionId: '', kind, agents: [] })),
  ]
  const roomCols = Math.ceil(Math.sqrt(cells.length))
  const roomRows = Math.ceil(cells.length / roomCols)
  const most = Math.max(3, ...cells.map(c => c.agents.length))
  const chrome = { w: MARGIN * 2 + SIDE_WALL * 2 + CORRIDOR * 2, h: MARGIN * 3 + SIGN_H + BOARD_H + OUTER_WALL + CORRIDOR * 2 }

  const sizeFor = (deskCols: number) => {
    const sizes = cells.map(c => roomSize(
      c.agents.length || 3,
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
      w: chrome.w + colW.reduce((a, b) => a + b, 0) + CORRIDOR * (roomCols - 1),
      h: chrome.h + rowH.reduce((a, b) => a + b, 0) + CORRIDOR * (roomRows - 1),
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

  // The building takes all the height the sign and the board leave; the rooms sit centred in it.
  const sign = { x: MARGIN, y: MARGIN, w: officeW - MARGIN * 2, h: SIGN_H }
  const board = { x: MARGIN, y: officeH - MARGIN - BOARD_H, w: officeW - MARGIN * 2, h: BOARD_H }
  const building = { x: MARGIN, y: sign.y + SIGN_H + MARGIN, w: officeW - MARGIN * 2, h: board.y - MARGIN - (sign.y + SIGN_H + MARGIN) }
  const gridW = size.w - chrome.w
  const gridH = size.h - chrome.h
  const originX = building.x + Math.floor((building.w - gridW) / 2)
  const originY = building.y + OUTER_WALL + Math.floor((building.h - OUTER_WALL - gridH) / 2)

  const boxes: RoomBox[] = []
  const desks: Desk[] = []
  cells.forEach((cell, i) => {
    const col = i % roomCols
    const row = Math.floor(i / roomCols)
    const x = originX + size.colW
      .slice(
        0,
        col)
      .reduce((a, b) => a + b + CORRIDOR, 0)
    const y = originY + size.rowH
      .slice(
        0,
        row)
      .reduce((a, b) => a + b + CORRIDOR, 0)
    boxes.push({ sessionId: cell.sessionId, kind: cell.kind, x, y, w: size.colW[col], h: size.rowH[row] })
    seating(cell.agents).forEach((a, d) => desks.push({
      sessionId: cell.sessionId,
      agentId: a.id,
      x: x + PAD + (d % deskCols) * DESK_W,
      y: y + WALL_H + PAD + Math.floor(d / deskCols) * DESK_H,
      w: DESK_W,
      h: DESK_H,
    }))
  })
  return { width: officeW, height: officeH, rooms: boxes, desks, building, sign, board }
}

const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

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

const outlineRect = (c: Canvas, { x, y, w, h }: Box, rgb: Rgb) => {
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

// Text with a one-pixel shadow, so it reads on wood and on chalkboard alike.
const label = (c: Canvas, text: string, x: number, y: number, rgb: Rgb, shadow: Rgb) => {
  drawText(
    c,
    text,
    x + 1,
    y + 1,
    shadow)
  return drawText(
    c,
    text,
    x,
    y,
    rgb)
}

const framed = (c: Canvas, box: Box, fill: Rgb) => {
  fillRect(
    c,
    box.x + 2,
    box.y + 2,
    box.w,
    box.h,
    PALETTE.outline)
  fillRect(
    c,
    box.x,
    box.y,
    box.w,
    box.h,
    PALETTE.woodDark)
  fillRect(
    c,
    box.x + 2,
    box.y + 2,
    box.w - 4,
    box.h - 4,
    PALETTE.wood)
  fillRect(
    c,
    box.x + 4,
    box.y + 4,
    box.w - 8,
    box.h - 8,
    fill)
  outlineRect(
    c,
    box,
    PALETTE.outline)
  for (const [bx, by] of [[box.x + 2, box.y + 2], [box.x + box.w - 3, box.y + 2], [box.x + 2, box.y + box.h - 3], [box.x + box.w - 3, box.y + box.h - 3]]) fillRect(
    c,
    bx,
    by,
    1,
    1,
    PALETTE.bolt)
}

const drawSign = (c: Canvas, box: Box, header: string) => {
  framed(
    c,
    box,
    PALETTE.woodLight)
  label(
    c,
    fit(
      header,
      box.w - 16),
    box.x + 8,
    box.y + 6,
    PALETTE.white,
    PALETTE.woodDark)
}

const drawBoard = (c: Canvas, box: Box, hud: Hud) => {
  const ink = hud.isPaper ? PALETTE.outline : PALETTE.chalk
  const dim = hud.isPaper ? PALETTE.gray : PALETTE.chalkDim
  framed(
    c,
    box,
    hud.isPaper ? PALETTE.paper : PALETTE.chalkboard)
  if (hud.isPaper) for (let y = box.y + 14; y < box.y + box.h - 4; y += LINE_H) fillRect(
    c,
    box.x + 4,
    y + GLYPH_H,
    box.w - 8,
    1,
    PALETTE.paperLine)
  label(
    c,
    hud.title,
    box.x + 8,
    box.y + 5,
    ink,
    hud.isPaper ? PALETTE.paperLine : PALETTE.chalkboardDark)
  const hintW = hud.hint.length * GLYPH_W
  drawText(
    c,
    fit(
      hud.hint,
      box.w - 16 - (hud.title.length + 2) * GLYPH_W),
    Math.max(
      box.x + 8 + (hud.title.length + 2) * GLYPH_W,
      box.x + box.w - 8 - hintW),
    box.y + 5,
    dim)
  hud.lines.slice(
    0,
    BOARD_LINES).forEach((line, i) => {
    const y = box.y + 13 + i * LINE_H
    if (line.icon) drawSprite(
      c,
      SPRITES.icons[line.icon],
      box.x + 8,
      y - 1)
    drawText(
      c,
      fit(
        line.text,
        box.w - 28),
      box.x + 18,
      y,
      ink)
  })
}

// Outer walls with a row of windows, and corridor floor everywhere inside.
const drawBuilding = (c: Canvas, box: Box) => {
  fillRect(
    c,
    box.x + 3,
    box.y + 3,
    box.w,
    box.h,
    PALETTE.outline)
  fillRect(
    c,
    box.x,
    box.y,
    box.w,
    box.h,
    PALETTE.buildingWall)
  tile(
    c,
    SPRITES.floorConcrete,
    { x: box.x + SIDE_WALL, y: box.y + OUTER_WALL, w: box.w - SIDE_WALL * 2, h: box.h - OUTER_WALL - SIDE_WALL })
  tile(
    c,
    SPRITES.wallTop,
    { x: box.x, y: box.y, w: box.w, h: OUTER_WALL })
  for (let x = box.x + 20; x + SPRITES.window.w < box.x + box.w - 20; x += 48) drawSprite(
    c,
    SPRITES.window,
    x,
    box.y + 3)
  outlineRect(
    c,
    box,
    PALETTE.outline)
}

const rug = (c: Canvas, box: Box) => {
  fillRect(
    c,
    box.x,
    box.y,
    box.w,
    box.h,
    PALETTE.rug)
  outlineRect(
    c,
    { x: box.x + 2, y: box.y + 2, w: box.w - 4, h: box.h - 4 },
    PALETTE.rugLight)
}

const drawCommons = (c: Canvas, box: RoomBox) => {
  const inner = { x: box.x + PAD, y: box.y + WALL_H + PAD, w: box.w - PAD * 2, h: box.h - WALL_H - PAD * 2 }
  const cx = box.x + Math.floor(box.w / 2)
  if (box.kind === 'lounge') {
    rug(
      c,
      { x: cx - 36, y: inner.y + 6, w: 72, h: 40 })
    drawSprite(
      c,
      SPRITES.sofa,
      cx - 12,
      inner.y + 4)
    drawSprite(
      c,
      SPRITES.coffeeTable,
      cx - 7,
      inner.y + 22)
    drawSprite(
      c,
      SPRITES.bookshelf,
      inner.x,
      inner.y)
    return
  }
  drawSprite(
    c,
    SPRITES.coffeeMachine,
    inner.x,
    inner.y)
  drawSprite(
    c,
    SPRITES.waterCooler,
    inner.x + 28,
    inner.y + 1)
  drawSprite(
    c,
    SPRITES.coffeeTable,
    cx - 7,
    inner.y + 28)
}

const ROOM_TITLES: Record<RoomKind, string> = { session: '', empty: '', lounge: 'LOUNGE', kitchen: 'KITCHEN' }

const drawRoom = (c: Canvas, box: RoomBox, room: RoomFile | undefined) => {
  tile(
    c,
    box.kind === 'kitchen' || (box.kind === 'session' && hash(box.sessionId) % 2) ? SPRITES.floorTile : SPRITES.floorWood,
    { ...box, y: box.y + WALL_H, h: box.h - WALL_H })
  tile(
    c,
    SPRITES.wallTop,
    { ...box, h: WALL_H })
  outlineRect(
    c,
    box,
    PALETTE.outline)
  // A doorway in the bottom wall onto the corridor.
  fillRect(
    c,
    box.x + Math.floor(box.w / 2) - 8,
    box.y + box.h - 1,
    16,
    1,
    PALETTE.corridor)
  drawSprite(
    c,
    SPRITES.plant,
    box.x + box.w - 12,
    box.y + box.h - 16)
  if (box.kind === 'lounge' || box.kind === 'kitchen') {
    label(
      c,
      ROOM_TITLES[box.kind],
      box.x + 6,
      box.y + 5,
      PALETTE.white,
      PALETTE.outline)
    drawCommons(
      c,
      box)
    return
  }
  if (box.w >= 150) drawSprite(
    c,
    SPRITES.whiteboard,
    box.x + box.w - 30,
    box.y + 3)
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
  label(
    c,
    fit(
      room.name,
      box.w - 40),
    box.x + 6,
    box.y + 5,
    PALETTE.white,
    PALETTE.outline)
}

const drawBubble = (c: Canvas, desk: Desk, agent: DeskAgent) => {
  if (!agent.action) return
  const text = fit(
    agent.action.label,
    DESK_W - 15)
  const w = Math.min(
    DESK_W - 2,
    12 + text.length * GLYPH_W)
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
    text,
    x + 11,
    y + 3,
    PALETTE.outline)
}

const nameTag = (c: Canvas, name: string, cx: number, y: number) => {
  const text = fit(
    name,
    DESK_W - 2)
  drawText(
    c,
    text,
    cx - Math.floor(text.length * GLYPH_W / 2),
    y,
    PALETTE.outline)
}

const hat = (c: Canvas, agent: DeskAgent, x: number, y: number) => {
  if (agent.id === null) drawSprite(
    c,
    SPRITES.crown,
    x + 3,
    y - 2)
  else drawSprite(
    c,
    SPRITES.cap,
    x + 2,
    y)
}

// An agent away from its desk: walking there or back, or standing in the kitchen.
const drawFigure = (c: Canvas, agent: DeskAgent, sessionId: string, figure: Figure, tick: number) => {
  const shirt = hash(agent.id ?? sessionId) % 6
  drawSprite(
    c,
    figure.isWalking ? SPRITES.person.walk[Math.floor(tick / 2) % 2] : SPRITES.person.stand,
    figure.x,
    figure.y,
    { body: `shirt${shirt}`, bodyDark: `shirt${shirt}d` })
  hat(
    c,
    agent,
    figure.x,
    figure.y)
  if (!figure.isWalking) nameTag(
    c,
    agent.name,
    figure.x + 5,
    figure.y + 16)
}

const drawDesk = (c: Canvas, desk: Desk, agent: DeskAgent, tick: number, isSelected: boolean, isAway: boolean) => {
  const shirt = hash(agent.id ?? desk.sessionId) % 6
  const recolor = { body: `shirt${shirt}`, bodyDark: `shirt${shirt}d` }
  const cx = desk.x + DESK_W / 2
  const isRunning = agent.status === 'running' && !isAway
  const monitor = agent.needsYou && !isAway
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
  if (!isAway) {
    drawSprite(
      c,
      person,
      cx - 5,
      desk.y + 27,
      recolor)
    hat(
      c,
      agent,
      cx - 5,
      desk.y + 27)
  }
  drawSprite(
    c,
    SPRITES.chair,
    cx - 7,
    desk.y + 40)
  nameTag(
    c,
    isAway ? `${agent.name} (break)` : agent.name,
    cx,
    desk.y + 50)
  if (!isAway) drawBubble(
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

export const drawOffice = (office: Office, rooms: RoomFile[], tick: number, selected: Desk | null, hud?: Hud, figures: Map<string, Figure> = new Map()): Canvas => {
  const c = createCanvas(
    office.width,
    office.height,
    PALETTE.navy)
  drawBuilding(
    c,
    office.building)
  for (const box of office.rooms) drawRoom(
    c,
    box,
    rooms.find(r => box.kind === 'session' && r.sessionId === box.sessionId))
  for (const desk of office.desks) {
    const agent = rooms
      .find(r => r.sessionId === desk.sessionId)
      ?.agents.find(a => a.id === desk.agentId)
    if (agent) drawDesk(
      c,
      desk,
      agent,
      tick,
      selected?.sessionId === desk.sessionId && selected.agentId === desk.agentId,
      figures.has(agentKey(
        desk.sessionId,
        desk.agentId)))
  }
  for (const desk of office.desks) {
    const figure = figures.get(agentKey(
      desk.sessionId,
      desk.agentId))
    const agent = rooms
      .find(r => r.sessionId === desk.sessionId)
      ?.agents.find(a => a.id === desk.agentId)
    if (figure && agent) drawFigure(
      c,
      agent,
      desk.sessionId,
      figure,
      tick)
  }
  if (hud) {
    drawSign(
      c,
      office.sign,
      hud.header)
    drawBoard(
      c,
      office.board,
      hud)
  }
  return c
}
