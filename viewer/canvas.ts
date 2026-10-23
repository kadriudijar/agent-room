import { FONT, PALETTE, type Rgb, type Sprite } from './sprites.ts'

export type Canvas = { width: number; height: number; data: Uint8Array }

export const createCanvas = (width: number, height: number, rgb: Rgb = PALETTE.grass): Canvas => {
  const c = { width, height, data: new Uint8Array(width * height * 4) }
  fillRect(
    c,
    0,
    0,
    width,
    height,
    rgb)
  return c
}

const put = (c: Canvas, x: number, y: number, [r, g, b]: Rgb) => {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return
  const i = (y * c.width + x) * 4
  c.data[i] = r
  c.data[i + 1] = g
  c.data[i + 2] = b
  c.data[i + 3] = 255
}

export const fillRect = (c: Canvas, x: number, y: number, w: number, h: number, rgb: Rgb) => {
  for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) put(
      c,
      xx,
      yy,
      rgb)
}

// `recolor` swaps palette keys for this draw: a person's body colour, a helper's cap.
export const drawSprite = (c: Canvas, s: Sprite, x: number, y: number, recolor: Record<string, string> = {}) => {
  for (let yy = 0; yy < s.h; yy++)
    for (let xx = 0; xx < s.w; xx++) {
      const key = s.px[yy * s.w + xx]
      if (key) put(
        c,
        x + xx,
        y + yy,
        PALETTE[recolor[key] ?? key])
    }
}

export const GLYPH_W = 4
export const GLYPH_H = 6

// Draws upper-cased text in the 3×5 pixel font; a glyph the font lacks draws as `?`.
export const drawText = (c: Canvas, text: string, x: number, y: number, rgb: Rgb) => {
  let cx = x
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT['?']
    for (let yy = 0; yy < 5; yy++)
      for (let xx = 0; xx < 3; xx++)
        if (glyph[yy][xx] === '#') put(
          c,
          cx + xx,
          y + yy,
          rgb)
    cx += GLYPH_W
  }
  return cx - x
}
