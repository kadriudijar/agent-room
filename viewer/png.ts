import { crc32, deflateSync, inflateSync } from 'node:zlib'
import type { Canvas } from './canvas.ts'

const chunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([
    Buffer.from(type, 'ascii'),
    data,
  ])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([
    length,
    body,
    crc,
  ])
}

// RGBA, 8 bits per channel (colour type 6), filter 0 on every row.
export const encodePng = (c: Canvas) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(
    c.width,
    0)
  header.writeUInt32BE(
    c.height,
    4)
  header.set(
    [8, 6, 0, 0, 0],
    8)
  const stride = c.width * 4
  const raw = Buffer.alloc((stride + 1) * c.height)
  for (let y = 0; y < c.height; y++) raw.set(
    c.data.subarray(
      y * stride,
      (y + 1) * stride),
    y * (stride + 1) + 1)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk(
      'IHDR',
      header),
    chunk(
      'IDAT',
      deflateSync(
        raw,
        { level: 1 })),
    chunk(
      'IEND',
      Buffer.alloc(0)),
  ])
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// 8-bit RGB or RGBA, not interlaced: what encodePng writes and what the art sheets are.
export const decodePng = (png: Buffer): Canvas => {
  let width = 0
  let height = 0
  let channels = 0
  const idat: Buffer[] = []
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at)
    const type = png.toString(
      'ascii',
      at + 4,
      at + 8)
    const data = png.subarray(
      at + 8,
      at + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0 || (data[9] !== 2 && data[9] !== 6)) throw new Error('PNG must be 8-bit RGB or RGBA, not interlaced')
      channels = data[9] === 6 ? 4 : 3
    }
    if (type === 'IDAT') idat.push(data)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const rows = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x]
      const left = x >= channels ? rows[y * stride + x - channels] : 0
      const up = y ? rows[(y - 1) * stride + x] : 0
      const upLeft = y && x >= channels ? rows[(y - 1) * stride + x - channels] : 0
      const predicted = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(
        left,
        up,
        upLeft) : 0
      rows[y * stride + x] = (value + predicted) & 255
    }
  }
  const out = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = rows[i * channels]
    out[i * 4 + 1] = rows[i * channels + 1]
    out[i * 4 + 2] = rows[i * channels + 2]
    out[i * 4 + 3] = channels === 4 ? rows[i * channels + 3] : 255
  }
  return { width, height, data: out }
}
