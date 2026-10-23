import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Icon } from '../mod/types/index.d.ts'
import type { Canvas } from './canvas.ts'
import { decodePng } from './png.ts'
import { cut, findSprites, keyGreen, type Merge, shrink } from './sheet.ts'

// One worker's frames: seated at the desk (typing ×2, leaning back, still), standing, walking ×2.
export type Look = { seated: Canvas[]; stand: Canvas; walk: Canvas[] }
export type Furniture =
  | 'sofa' | 'armchair' | 'coffeeTable' | 'rug' | 'bookshelf' | 'beanbag' | 'pingpong' | 'tv'
  | 'counter' | 'cooler' | 'fridge' | 'microwave' | 'dining' | 'fruit' | 'whiteboard'
export type Art = {
  boss: Look[]
  interns: Look[]
  // A desk whose sitter is on break, its chair pushed back.
  emptyDesk: Canvas
  chairTurned: Canvas
  floors: { cream: Canvas; wood: Canvas; woodDark: Canvas; corridor: Canvas; kitchen: Canvas }
  wallTop: Canvas
  window: Canvas
  plant: Canvas
  furniture: Record<Furniture, Canvas>
  icons: Record<Icon | 'coffee' | 'alert', Canvas>
  // Panels stretched as nine-slices.
  ui: { sign: Canvas; chalkboard: Canvas; clipboard: Canvas; bubble: Canvas }
}

// The office's sizes for each kind of sprite, in logical pixels.
export const STATION = { w: 44, h: 38 }
const FIGURE = { w: 14, h: 24 }
const FURNITURE: Record<Furniture, [number, number]> = {
  sofa: [30, 16],
  armchair: [14, 16],
  coffeeTable: [20, 12],
  rug: [48, 26],
  bookshelf: [18, 24],
  beanbag: [14, 12],
  pingpong: [30, 22],
  tv: [26, 18],
  counter: [34, 20],
  cooler: [10, 18],
  fridge: [14, 24],
  microwave: [16, 10],
  dining: [28, 24],
  fruit: [10, 7],
  whiteboard: [24, 22],
}
const FURNITURE_ORDER = Object.keys(FURNITURE) as Furniture[]
const ICONS: (Icon | 'coffee' | 'alert')[] = ['read', 'edit', 'bash', 'web', 'agent', 'ask', 'other', 'coffee', 'alert']

const sheet = (dir: string, name: string, merge?: Merge) => {
  const image = keyGreen(decodePng(readFileSync(join(
    dir,
    `${name}.png`))))
  return findSprites(
    image,
    merge).map(box => cut(
    image,
    box))
}

// A floor tile's middle, square, without the outline the generator drew round it, at `size` px:
// smaller for patterned floors, so their squares sit in scale with the furniture.
const floor = (tile: Canvas, size: number) => {
  const side = Math.floor(Math.min(tile.width, tile.height) * 0.86)
  return shrink(
    cut(
      tile,
      { x: Math.floor((tile.width - side) / 2), y: Math.floor((tile.height - side) / 2), w: side, h: side }),
    size,
    size)
}

const looks = (frames: Canvas[]): Look[] => Array.from(
  { length: Math.floor(frames.length / 7) },
  (_, row) => {
    const at = (i: number, size: { w: number; h: number }) => shrink(
      frames[row * 7 + i],
      size.w,
      size.h)
    return {
      seated: [0, 1, 2, 3].map(i => at(
        i,
        STATION)),
      stand: at(
        4,
        FIGURE),
      walk: [5, 6].map(i => at(
        i,
        FIGURE)),
    }
  })

const SHEETS = ['boss', 'interns', 'desks', 'tiles', 'building', 'breakroom', 'icons', 'ui']

// The generated sheets in `dir`, cut into the office's sprites; undefined when any is missing or
// unreadable, so the office keeps its drawn-in-code look.
export const loadArt = (dir: string): Art | undefined => {
  if (!SHEETS.every(name => existsSync(join(
    dir,
    `${name}.png`)))) return undefined
  try {
    const desks = sheet(
      dir,
      'desks')
    const tiles = sheet(
      dir,
      'tiles')
    const building = sheet(
      dir,
      'building')
    const breakroom = sheet(
      dir,
      'breakroom')
    const icons = sheet(
      dir,
      'icons',
      { across: 16, down: 48 })
    const ui = sheet(
      dir,
      'ui')
    return {
      boss: looks(sheet(
        dir,
        'boss')),
      interns: looks(sheet(
        dir,
        'interns')),
      emptyDesk: shrink(
        desks[0],
        40,
        26),
      chairTurned: shrink(
        desks[5],
        14,
        16),
      floors: {
        cream: floor(
          tiles[0],
          8),
        wood: floor(
          tiles[1],
          16),
        woodDark: floor(
          tiles[2],
          16),
        corridor: floor(
          tiles[4],
          16),
        kitchen: floor(
          tiles[5],
          12),
      },
      wallTop: shrink(
        tiles[8],
        16,
        16),
      window: shrink(
        building[0],
        22,
        20),
      plant: shrink(
        building[11],
        10,
        14),
      furniture: Object.fromEntries(FURNITURE_ORDER.map((name, i) => [name, shrink(
        breakroom[i],
        ...FURNITURE[name])])) as Record<Furniture, Canvas>,
      icons: Object.fromEntries(ICONS.map((name, i) => [name, shrink(
        icons[i],
        7,
        7)])) as Art['icons'],
      ui: { sign: ui[0], chalkboard: ui[1], clipboard: ui[2], bubble: ui[3] },
    }
  } catch {
    return undefined
  }
}
