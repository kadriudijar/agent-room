#!/usr/bin/env node
// claude-room: every open Claude Code session as a room of a pixel office, full screen in Ghostty.
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RoomFile } from '../mod/types/index.d.ts'
import { GLYPH_W, scaleCanvas } from './canvas.ts'
import { BOARD_LINES, drawOffice, type Desk, type Hud } from './office.ts'
import { focusSession } from './focus.ts'
import { encodePng } from './png.ts'
import { createRoomReader } from './rooms.ts'
import {
  deleteImages,
  deskAt,
  enterScreen,
  fitScale,
  type Input,
  leaveScreen,
  parseInput,
  probeGraphics,
  querySize,
  type Size,
  showImage,
  tooSmall,
} from './terminal.ts'
import { detailLines, headerLine, logLines } from './text.ts'

const FRAME_MS = 200
const HINT = 'CLICK OR TAB: PICK A DESK · Q: QUIT'

type Selection = { sessionId: string; agentId: string | null }
export type Focus = typeof focusSession

const dir = join(
  process.env.CLAUDE_CONFIG_DIR ?? join(
    homedir(),
    '.claude'),
  'agent-room')

const row = (n: number, text: string) => `\x1b[${n};1H\x1b[2K${text}`

export const run = async (focus: Focus = focusSession) => {
  mkdirSync(
    dir,
    { recursive: true })
  enterScreen()
  if (!(await probeGraphics())) {
    leaveScreen()
    process.stderr.write('claude-room needs a terminal with kitty graphics (Ghostty, kitty).\n')
    process.exit(1)
  }
  const reader = createRoomReader(dir)
  let size: Size = await querySize()
  let tick = 0
  let selected: Selection | null = null
  let message: string | null = null
  let lastPng: Buffer | null = null
  let desks: Desk[] = []
  let rooms: RoomFile[] = []
  let fit: ReturnType<typeof fitScale> | null = null

  const quit = () => {
    leaveScreen()
    process.exit(0)
  }

  const frame = () => {
    rooms = reader.read(Date.now())
    if (tooSmall(size)) {
      if (lastPng) deleteImages()
      lastPng = null
      process.stdout.write(`\x1b[2J${row(
        1,
        'Make this tab bigger')}`)
      return
    }
    fit = fitScale(
      rooms,
      size)
    desks = fit.office.desks
    const desk = selected && desks.find(d => d.sessionId === selected!.sessionId && d.agentId === selected!.agentId)
    if (selected && !desk) selected = null
    const room = selected && rooms.find(r => r.sessionId === selected!.sessionId)
    const agent = room?.agents.find(a => a.id === selected!.agentId)
    const cols = Math.floor(fit.office.width / GLYPH_W)
    const hud: Hud = room && agent
      ? {
        header: headerLine(
          rooms,
          Date.now(),
          cols),
        title: 'DESK',
        lines: [...(message ? [{ text: message }] : []), ...detailLines(
          room,
          agent,
          cols)],
        hint: 'ENTER: GO TO SESSION · ESC: BACK',
        isPaper: true,
      }
      : {
        header: headerLine(
          rooms,
          Date.now(),
          cols),
        title: 'ACTIVITY',
        lines: logLines(
          rooms,
          BOARD_LINES,
          cols),
        hint: HINT,
      }
    const png = encodePng(scaleCanvas(
      drawOffice(
        fit.office,
        rooms,
        tick,
        desk ?? null,
        hud),
      fit.scale))
    if (!lastPng || !png.equals(lastPng)) {
      showImage(
        png,
        1,
        1,
        fit.cols,
        fit.rows)
      lastPng = png
    }
  }

  const select = (desk: Desk | undefined) => {
    selected = desk ? { sessionId: desk.sessionId, agentId: desk.agentId } : null
    message = null
    lastPng = null
    process.stdout.write('\x1b[2J')
  }

  const step = (by: number) => {
    if (!desks.length) return
    const at = desks.findIndex(d => d.sessionId === selected?.sessionId && d.agentId === selected?.agentId)
    select(desks[(at + by + desks.length) % desks.length])
  }

  const onInput = async (input: Input) => {
    if (input.kind === 'click') {
      if (fit) select(deskAt(
        fit,
        size,
        input.col,
        input.row))
      return
    }
    switch (input.key) {
      case 'q': return quit()
      case 'esc': return select(undefined)
      case 'tab':
      case 'right':
      case 'down': return step(1)
      case 'left':
      case 'up': return step(-1)
      case 'enter': {
        const room = selected && rooms.find(r => r.sessionId === selected!.sessionId)
        if (!room) return
        const result = await focus(room)
        message = result.ok ? null : result.reason
      }
    }
  }

  process.stdin.on(
    'data',
    (buf: Buffer) => {
      for (const input of parseInput(buf)) void onInput(input)
    })
  process.stdout.on(
    'resize',
    () => void querySize().then(next => {
      size = next
      lastPng = null
      process.stdout.write('\x1b[2J')
    }))
  process.on(
    'SIGTERM',
    quit)
  process.on(
    'exit',
    () => process.stdout.write('\x1b[?25h'))
  setInterval(
    () => {
      tick += 2
      try {
        frame()
      } catch (error) {
        leaveScreen()
        throw error
      }
    },
    FRAME_MS)
}

if (import.meta.main) void run()
