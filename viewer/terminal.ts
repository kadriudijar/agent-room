import type { RoomFile } from '../mod/types/index.d.ts'
import { type Desk, layoutOffice, type Office } from './office.ts'

export type Size = { cols: number; rows: number; cellW: number; cellH: number }
export type Key = 'up' | 'down' | 'left' | 'right' | 'enter' | 'esc' | 'q' | 'tab'
export type Input = { kind: 'click'; col: number; row: number } | { kind: 'key'; key: Key }
export type Fit = { scale: number; office: Office; cols: number; rows: number }

const ESC = '\x1b'
const MAX_SCALE = 6

export const tooSmall = ({ cols, rows }: Pick<Size, 'cols' | 'rows'>) => cols < 40 || rows < 15

// The largest whole-number scale whose office fills the tab without growing past it.
export const fitScale = (rooms: RoomFile[], size: Size): Fit => {
  const pxW = size.cols * size.cellW
  const pxH = size.rows * size.cellH
  for (let scale = MAX_SCALE; scale >= 1; scale--) {
    const office = layoutOffice(
      rooms,
      Math.floor(pxW / scale),
      Math.floor(pxH / scale))
    if (office.width * scale <= pxW && office.height * scale <= pxH || scale === 1)
      return {
        scale,
        office,
        cols: Math.min(
          size.cols,
          Math.ceil(office.width * scale / size.cellW)),
        rows: Math.min(
          size.rows,
          Math.ceil(office.height * scale / size.cellH)),
      }
  }
  throw new Error('unreachable')
}

// The desk under a click at 1-based terminal cell (col, row); the image starts on row 1.
export const deskAt = (fit: Fit, size: Size, col: number, row: number): Desk | undefined => {
  const x = ((col - 1) * size.cellW + size.cellW / 2) * (fit.office.width / (fit.cols * size.cellW))
  const y = ((row - 1) * size.cellH + size.cellH / 2) * (fit.office.height / (fit.rows * size.cellH))
  return fit.office.desks.find(d => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h)
}

const KEYS: Record<string, Key> = {
  [`${ESC}[A`]: 'up',
  [`${ESC}[B`]: 'down',
  [`${ESC}[C`]: 'right',
  [`${ESC}[D`]: 'left',
  '\r': 'enter',
  '\n': 'enter',
  '\t': 'tab',
  q: 'q',
  '\x03': 'q',
  [ESC]: 'esc',
}

export const parseInput = (buf: Buffer): Input[] => {
  const text = buf.toString('utf8')
  const inputs: Input[] = []
  let i = 0
  while (i < text.length) {
    const mouse = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(text.slice(i))
    if (mouse) {
      // Button 0 pressed; releases, drags and wheels are ignored.
      if (mouse[4] === 'M' && mouse[1] === '0') inputs.push({ kind: 'click', col: Number(mouse[2]), row: Number(mouse[3]) })
      i += mouse[0].length
      continue
    }
    // Any other CSI sequence (the terminal's replies, Delete, Home, Shift-Tab) is swallowed, not read as Esc.
    const csi = /^\x1b\[[0-9;?]*[ -\/]*[@-~]/.exec(text.slice(i))
    if (csi && !KEYS[csi[0]]) {
      i += csi[0].length
      continue
    }
    const arrow = text.slice(
      i,
      i + 3)
    if (KEYS[arrow]) {
      inputs.push({ kind: 'key', key: KEYS[arrow] })
      i += 3
      continue
    }
    const key = KEYS[text[i]]
    if (key) inputs.push({ kind: 'key', key })
    i += 1
  }
  return inputs
}

// Writes `query` and resolves the first reply matching `pattern`, or undefined after `ms`.
const ask = (query: string, pattern: RegExp, ms: number) => new Promise<RegExpExecArray | undefined>(resolve => {
  let seen = ''
  const done = (match: RegExpExecArray | undefined) => {
    clearTimeout(timer)
    process.stdin.off(
      'data',
      onData)
    resolve(match)
  }
  const onData = (chunk: Buffer) => {
    seen += chunk.toString('latin1')
    const match = pattern.exec(seen)
    if (match) done(match)
  }
  const timer = setTimeout(
    () => done(undefined),
    ms)
  process.stdin.on(
    'data',
    onData)
  process.stdout.write(query)
})

// The device-attributes reply after the query ends the wait early on a terminal without graphics.
export const probeGraphics = async () => (await ask(
  `${ESC}_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA${ESC}\\${ESC}[c`,
  /_Gi=31;OK|\x1b\[\?[\d;]*c/,
  500))?.[0].includes('OK') ?? false

export const querySize = async (): Promise<Size> => {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const reply = await ask(
    `${ESC}[16t`,
    /\x1b\[6;(\d+);(\d+)t/,
    500)
  return reply
    ? { cols, rows, cellW: Number(reply[2]), cellH: Number(reply[1]) }
    : { cols, rows, cellW: 8, cellH: 16 }
}

// Places a PNG over `cols × rows` cells at 1-based (col, row); image id 1 is replaced in place.
export const showImage = (png: Buffer, col: number, row: number, cols: number, rows: number) => {
  const data = png.toString('base64')
  let out = `${ESC}[${row};${col}H`
  for (let i = 0; i < data.length; i += 4096) {
    const more = i + 4096 < data.length ? 1 : 0
    const head = i === 0 ? `a=T,f=100,i=1,p=1,c=${cols},r=${rows},C=1,q=2,m=${more}` : `m=${more}`
    out += `${ESC}_G${head};${data.slice(
      i,
      i + 4096)}${ESC}\\`
  }
  process.stdout.write(out)
}

export const deleteImages = () => process.stdout.write(`${ESC}_Ga=d,d=A,q=2${ESC}\\`)

export const enterScreen = () => {
  process.stdin.setRawMode?.(true)
  process.stdin.resume()
  process.stdout.write(`${ESC}[?1049h${ESC}[?25l${ESC}[?1000h${ESC}[?1006h${ESC}[2J`)
}

export const leaveScreen = () => {
  deleteImages()
  process.stdout.write(`${ESC}[?1006l${ESC}[?1000l${ESC}[?25h${ESC}[?1049l`)
  process.stdin.setRawMode?.(false)
  process.stdin.pause()
}
