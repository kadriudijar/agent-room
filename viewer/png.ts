import { crc32, deflateSync } from 'node:zlib'
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
