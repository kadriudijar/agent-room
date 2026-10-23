import { BIG_FONT } from './font.ts'
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

export type Clip = { x: number; y: number; w: number; h: number }

// `recolor` swaps palette keys for this draw (a person's body colour); `clip` keeps it inside a box.
export const drawSprite = (c: Canvas, s: Sprite, x: number, y: number, recolor: Record<string, string> = {}, clip?: Clip) => {
  for (let yy = 0; yy < s.h; yy++)
    for (let xx = 0; xx < s.w; xx++) {
      const key = s.px[yy * s.w + xx]
      if (clip && (x + xx < clip.x || y + yy < clip.y || x + xx >= clip.x + clip.w || y + yy >= clip.y + clip.h)) continue
      if (key) put(
        c,
        x + xx,
        y + yy,
        PALETTE[recolor[key] ?? key])
    }
}

export const GLYPH_W = 4
export const GLYPH_H = 6
// The big font's advance and line: 5×9 glyphs, one pixel apart.
export const BIG_W = 6
export const BIG_H = 10

// Draws text in a pixel font: `small` (3×5, upper case) or `big` (5×7 with lower case and
// descenders). A glyph the font lacks draws as `?`. Returns the width drawn in px.
export const drawText = (c: Canvas, text: string, x: number, y: number, rgb: Rgb, font: 'small' | 'big' = 'small') => {
  const isBig = font === 'big'
  const glyphs = isBig ? BIG_FONT : FONT
  let cx = x
  for (const ch of isBig ? text : text.toUpperCase()) {
    const glyph = glyphs[ch] ?? glyphs['?']
    for (let yy = 0; yy < glyph.length; yy++)
      for (let xx = 0; xx < glyph[yy].length; xx++)
        if (glyph[yy][xx] === '#') put(
          c,
          cx + xx,
          y + yy,
          rgb)
    cx += isBig ? BIG_W : GLYPH_W
  }
  return cx - x
}

// Nearest-neighbour upscale by a whole number, so pixels stay crisp.
export const scaleCanvas = (c: Canvas, scale: number): Canvas => {
  if (scale === 1) return c
  const width = c.width * scale
  const out = { width, height: c.height * scale, data: new Uint8Array(width * c.height * scale * 4) }
  const src = new Uint32Array(c.data.buffer, c.data.byteOffset, c.width * c.height)
  const dst = new Uint32Array(out.data.buffer)
  for (let y = 0; y < c.height; y++) {
    const line = (y * scale) * width
    for (let x = 0; x < c.width; x++) dst.fill(
      src[y * c.width + x],
      line + x * scale,
      line + (x + 1) * scale)
    for (let r = 1; r < scale; r++) dst.copyWithin(
      line + r * width,
      line,
      line + width)
  }
  return out
}
