export type Rgb = [number, number, number]
export type Sprite = { w: number; h: number; px: (string | null)[] }

export const PALETTE: Record<string, Rgb> = {
  grass: [74, 110, 58],
  grassDark: [58, 90, 46],
  white: [250, 248, 240],
  black: [20, 18, 26],
  outline: [44, 38, 52],
  cream: [236, 224, 196],
  creamDark: [222, 206, 172],
  tileLine: [208, 192, 160],
  wood: [176, 112, 64],
  woodDark: [132, 80, 44],
  woodLight: [204, 142, 86],
  plank: [150, 96, 56],
  navy: [48, 56, 92],
  navyLight: [72, 84, 128],
  trim: [196, 172, 120],
  glass: [140, 196, 224],
  glassLight: [196, 228, 244],
  leaf: [72, 150, 72],
  leafDark: [44, 110, 52],
  leafLight: [120, 190, 96],
  pot: [184, 96, 64],
  potDark: [140, 68, 44],
  skin: [240, 196, 156],
  skinDark: [208, 156, 116],
  hair: [70, 46, 32],
  hairDark: [44, 28, 20],
  body: [90, 130, 210],
  bodyDark: [60, 92, 170],
  cap: [230, 120, 60],
  crown: [248, 200, 64],
  crownDark: [200, 150, 40],
  metal: [70, 72, 86],
  metalLight: [110, 114, 130],
  screen: [24, 30, 44],
  code1: [120, 220, 140],
  code2: [120, 180, 250],
  code3: [250, 210, 110],
  code4: [230, 130, 180],
  alert: [228, 60, 60],
  alertDark: [160, 30, 36],
  gray: [150, 150, 160],
  book1: [200, 80, 70],
  book2: [70, 120, 190],
  book3: [90, 160, 90],
  book4: [220, 180, 80],
  select: [255, 220, 60],
  intern: [124, 196, 84],
  internStripe: [236, 240, 220],
  beanie: [222, 84, 60],
  beanieDark: [170, 56, 44],
  corridor: [196, 192, 184],
  corridorLine: [176, 172, 164],
  rug: [150, 70, 70],
  rugLight: [180, 96, 90],
  buildingWall: [92, 84, 104],
  chalkboard: [46, 74, 58],
  chalkboardDark: [36, 58, 46],
  chalk: [232, 232, 216],
  chalkDim: [170, 190, 172],
  paper: [244, 238, 220],
  paperLine: [214, 206, 186],
  bolt: [190, 190, 200],
  // Six body colours, picked per agent.
  shirt0: [90, 130, 210],
  shirt0d: [60, 92, 170],
  shirt1: [214, 92, 92],
  shirt1d: [170, 62, 66],
  shirt2: [96, 176, 112],
  shirt2d: [64, 136, 82],
  shirt3: [160, 110, 200],
  shirt3d: [120, 78, 160],
  shirt4: [232, 160, 70],
  shirt4d: [190, 120, 46],
  shirt5: [70, 170, 180],
  shirt5d: [46, 130, 140],
}

// Rows of characters, `.` transparent, each other character a key of `key`.
export const sprite = (rows: string[], key: Record<string, string>): Sprite => {
  const w = [...rows[0]].length
  const bad = rows.findIndex(row => [...row].length !== w)
  if (bad >= 0) throw new Error(`sprite row ${bad} is ${[...rows[bad]].length} wide, not ${w}: ${rows[bad]}`)
  return {
    w,
    h: rows.length,
    px: rows.flatMap(row => [...row].map(ch => (ch === '.' ? null : key[ch] ?? null))),
  }
}

const WOOD = { o: 'outline', w: 'wood', d: 'woodDark', l: 'woodLight', p: 'plank' }

const floorTile = sprite(
  [
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'cccccccccccccccl',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'kkkkkkkklkkkkkkk',
    'llllllllllllllll',
  ],
  { c: 'cream', k: 'creamDark', l: 'tileLine' })

const floorWood = sprite(
  [
    'wwwwwwwwwwwwwwwd',
    'wwwwwwwwwwwwwwwd',
    'llllllllllllllld',
    'dddddddddddddddd',
    'wwwwwwwdwwwwwwww',
    'wwwwwwwdwwwwwwww',
    'llllllllllllllll',
    'dddddddddddddddd',
    'wwwwwwwwwwwwdwww',
    'wwwwwwwwwwwwdwww',
    'llllllllllllllll',
    'dddddddddddddddd',
    'wwwdwwwwwwwwwwww',
    'wwwdwwwwwwwwwwww',
    'llllllllllllllll',
    'dddddddddddddddd',
  ],
  WOOD)

const wallTop = sprite(
  [
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'NNNNNNNNNNNNNNNN',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'tttttttttttttttt',
    'TTTTTTTTTTTTTTTT',
    'oooooooooooooooo',
    'oooooooooooooooo',
  ],
  { n: 'navy', N: 'navyLight', t: 'trim', T: 'woodDark', o: 'outline' })

const wallSide = sprite(
  ['onno', 'onno', 'onNo', 'onno'],
  { o: 'outline', n: 'navy', N: 'navyLight' })

// Desk top seen from the front, 28 wide.
const desk = sprite(
  [
    'oooooooooooooooooooooooooooo',
    'ollllllllllllllllllllllllllo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'oddddddddddddddddddddddddddo',
    'oooooooooooooooooooooooooooo',
    '.od......................do.',
    '.od......................do.',
    '.oo......................oo.',
  ],
  WOOD)

// Monitor facing the viewer; the screen area is 12×7 from (1,1).
const monitorRows = (screen: string[]) => [
  'mmmmmmmmmmmmmm',
  ...screen.map(row => `m${row}m`),
  'mmmmmmmmmmmmmm',
  '.....MMMM.....',
  '....mmmmmm....',
]
const MONITOR = { m: 'metal', M: 'metalLight', s: 'screen', a: 'code1', b: 'code2', c: 'code3', d: 'code4', r: 'alert' }
const monitorOff = sprite(
  monitorRows([
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
  ]),
  MONITOR)
const monitorOn = [
  sprite(
    monitorRows([
      'saaaasbbbsss',
      'ssbbbbbsssss',
      'ssscccsddsss',
      'saaassssssss',
      'ssbbbbcccsss',
      'sssddddsssss',
      'saaaaasbbsss',
    ]),
    MONITOR),
  sprite(
    monitorRows([
      'ssbbbbbsssss',
      'ssscccsddsss',
      'saaassssssss',
      'ssbbbbcccsss',
      'sssddddsssss',
      'saaaaasbbsss',
      'sssccsssssss',
    ]),
    MONITOR),
]
const monitorAlert = sprite(
  monitorRows([
    'ssssssssssss',
    'sssssrrsssss',
    'sssssrrsssss',
    'sssssrrsssss',
    'ssssssssssss',
    'sssssrrsssss',
    'ssssssssssss',
  ]),
  MONITOR)

// Chair back, drawn over the sitter's lower body.
const chair = sprite(
  [
    '..mmmmmmmmmm..',
    '.mMMMMMMMMMMm.',
    '.mMmmmmmmmmMm.',
    '.mMmmmmmmmmMm.',
    '.mmmmmmmmmmmm.',
    '......mm......',
    '....mmmmmm....',
    '...m..mm..m...',
  ],
  { m: 'metal', M: 'metalLight' })

// A sitter seen from behind, facing the monitor. `b`/`B` are the body colour, `h` the hair.
const PERSON = { h: 'hair', H: 'hairDark', s: 'skin', S: 'skinDark', b: 'body', B: 'bodyDark', o: 'outline' }
const sit = sprite(
  [
    '...oooo...',
    '..ohhhho..',
    '.ohhhhhho.',
    '.ohhhhHho.',
    '.oShhhhSo.',
    '..oHhhHo..',
    '..obbbbo..',
    '.obbbbbbo.',
    'obbbbbbbbo',
    'obBbbbbBbo',
    'obBbbbbBbo',
    'obbbbbbbbo',
  ],
  PERSON)
const type = [
  sprite(
    [
      '...oooo...',
      '..ohhhho..',
      '.ohhhhhho.',
      '.ohhhhHho.',
      '.oShhhhSo.',
      '..oHhhHo..',
      'so.bbbbo..',
      'Sobbbbbbo.',
      'obbbbbbbbo',
      'obBbbbbBbs',
      'obBbbbbBbS',
      'obbbbbbbbo',
    ],
    PERSON),
  sprite(
    [
      '...oooo...',
      '..ohhhho..',
      '.ohhhhhho.',
      '.ohhhhHho.',
      '.oShhhhSo.',
      '..oHhhHo..',
      '..obbbb.os',
      '.obbbbbbos',
      'obbbbbbbbo',
      'sbBbbbbBbo',
      'SbBbbbbBbo',
      'obbbbbbbbo',
    ],
    PERSON),
]
// Leaning back, hands behind the head.
const lean = sprite(
  [
    '..........',
    '.s.oooo.s.',
    '.Sohhhhos.',
    '.oohhhhhoo',
    '..ohhhhHo.',
    '..oShhhSo.',
    '...oHhHo..',
    '..obbbbbo.',
    '.obbbbbbbo',
    '.obBbbbBbo',
    '.obBbbbBbo',
    '.obbbbbbbo',
  ],
  PERSON)
// Standing and walking, seen from the front.
const FRONT = { ...PERSON, k: 'black', D: 'navy' }
const front = (legs: string[]) => sprite(
  [
    '...oooo...',
    '..ohhhho..',
    '.ohhhhhho.',
    '.ohsssSho.',
    '.osksskso.',
    '..osssso..',
    '..obbbbo..',
    '.obbbbbbo.',
    'obbbbbbbbo',
    'sbBbbbbBbs',
    '.obbbbbbo.',
    ...legs,
  ],
  FRONT)
const stand = front([
  '..oDDDDo..',
  '..oD..Do..',
  '..oo..oo..',
])
const walk = [
  front([
    '..oDDDDo..',
    '.oD....Do.',
    '.oo....oo.',
  ]),
  front([
    '..oDDDDo..',
    '...oDDo...',
    '...oooo...',
  ]),
]

// Interns (subagents) wear a green striped polo: the body colours become stripes, row by row.
const internOf = (s: Sprite): Sprite => ({
  ...s,
  px: s.px.map((key, i) => (key === 'body' || key === 'bodyDark' ? (Math.floor(i / s.w) % 2 ? 'internStripe' : 'intern') : key)),
})
const beanie = sprite(
  ['..bbbb..', '.bbbbbb.', 'BBBBBBBB'],
  { b: 'beanie', B: 'beanieDark' })

const crown = sprite(
  ['y.y.y', 'yyyyy', 'YYYYY'],
  { y: 'crown', Y: 'crownDark' })
const cap = sprite(
  ['.cccc.', 'cccccc'],
  { c: 'cap' })

const plant = sprite(
  [
    '...gg.....',
    '..gGgg.g..',
    '.gGggggGg.',
    'gggGgGgggg',
    '.gGgggGgG.',
    'ggdgGgdggg',
    '.gdgggdgg.',
    '..ggdggg..',
    '...dddd...',
    '..oooooo..',
    '..pppppp..',
    '..pPPPPp..',
    '...pPPp...',
    '...oooo...',
  ],
  { g: 'leaf', G: 'leafLight', d: 'leafDark', o: 'outline', p: 'pot', P: 'potDark' })

const bookshelf = sprite(
  [
    'oooooooooooooooo',
    'owwwwwwwwwwwwwwo',
    'o1122334411223wo',
    'o1122334411223wo',
    'o1122334411223wo',
    'oddddddddddddddo',
    'ow33441122.344wo',
    'ow33441122.344wo',
    'ow33441122.344wo',
    'oddddddddddddddo',
    'o4411.22334411wo',
    'o4411.22334411wo',
    'o4411.22334411wo',
    'oddddddddddddddo',
    'oooooooooooooooo',
  ],
  { ...WOOD, 1: 'book1', 2: 'book2', 3: 'book3', 4: 'book4' })

const window = sprite(
  [
    'oooooooooooooooo',
    'oGGggggooGGggggo',
    'oGgggggooGgggggo',
    'oggggggooggggggo',
    'oooooooooooooooo',
    'oGgggggooGgggggo',
    'oggggggooggggggg',
    'oooooooooooooooo',
    'tttttttttttttttt',
  ],
  { o: 'outline', g: 'glass', G: 'glassLight', t: 'trim' })

const sign = sprite(
  [
    'oooooooooooooooooooooooooooooooooooooooooooo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
    'oddddddddddddddddddddddddddddddddddddddddddo',
    'oooooooooooooooooooooooooooooooooooooooooooo',
    '....................od......................',
    '....................od......................',
  ],
  WOOD)

const tree = sprite(
  [
    '....oooo....',
    '..ooGGggoo..',
    '.oGGgggggdo.',
    'oGgggggggddo',
    'oggggGggggdo',
    'ogggggggdddo',
    '.oggggggddo.',
    '..oddddddo..',
    '...oootoo...',
    '.....tt.....',
    '....oTTo....',
  ],
  { o: 'outline', g: 'leaf', G: 'leafLight', d: 'leafDark', t: 'woodDark', T: 'wood' })
const tuft = sprite(
  ['g.g', '.g.'],
  { g: 'grassDark' })

const floorConcrete = sprite(
  [
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'gggggggggggggggh',
    'hhhhhhhhhhhhhhhh',
  ],
  { g: 'corridor', h: 'corridorLine' })

const sofa = sprite(
  [
    '.oooooooooooooooooooooo.',
    'oSSSSSSSSSSSSSSSSSSSSSSo',
    'oSssssssssssssssssssssSo',
    'oSssssssssssssssssssssSo',
    'oSSSSSSSSSSSSSSSSSSSSSSo',
    'oSsssssssSsssssssSsssSSo',
    'oSsssssssSsssssssSssssSo',
    'oSSSSSSSSSSSSSSSSSSSSSSo',
    'oooooooooooooooooooooooo',
    '.oo..................oo.',
  ],
  { o: 'outline', S: 'shirt0d', s: 'shirt0' })

const coffeeTable = sprite(
  [
    'oooooooooooooo',
    'olllllllllllwo',
    'owwwwwwwwwwwwo',
    'oddddddddddddo',
    'oooooooooooooo',
    '.od........do.',
    '.oo........oo.',
  ],
  WOOD)

const waterCooler = sprite(
  [
    '..oooo..',
    '.oCCCCo.',
    '.oCccCo.',
    '.oCccCo.',
    '.oCCCCo.',
    'oooooooo',
    'owwwwwwo',
    'owrwwbwo',
    'owwwwwwo',
    'owwwwwwo',
    'owwwwwwo',
    'oooooooo',
  ],
  { o: 'outline', C: 'glass', c: 'glassLight', w: 'white', r: 'alert', b: 'book2' })

const coffeeMachine = sprite(
  [
    'oooooooooooooooooooo',
    'ommmmmmmmommmmmmmmmo',
    'omMMMMMMmommmmmmmmmo',
    'omMrrMMMmomkkmmmmmmo',
    'omMMMMMMmommmmmmmmmo',
    'ommmmmmmmomwwmmmmmmo',
    'ommmmmmmmomwwmmmmmmo',
    'oooooooooooooooooooo',
    'ollllllllllllllllllo',
    'owwwwwwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwo',
    'oddddddddddddddddddo',
    'oooooooooooooooooooo',
  ],
  { ...WOOD, m: 'metal', M: 'metalLight', r: 'alert', k: 'black', w: 'wood' })

const whiteboard = sprite(
  [
    'oooooooooooooooooooooooo',
    'owwwwwwwwwwwwwwwwwwwwwwo',
    'owbbbbbwwwwwrrrrwwwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwo',
    'owbbbwwbbbbwwwwwgggggwwo',
    'owwwwwwwwwwwwwwwwwwwwwwo',
    'owwggggwwwwwbbbbbbwwwwwo',
    'owwwwwwwwwwwwwwwwwwwwwwo',
    'oooooooooooooooooooooooo',
    '.MMMMMMMMMMMMMMMMMMMMMM.',
  ],
  { o: 'outline', w: 'white', b: 'book2', r: 'book1', g: 'book3', M: 'metal' })

const ICON = { o: 'outline', w: 'white', r: 'book1', b: 'book2', y: 'crown', g: 'code1', k: 'black', s: 'skin', c: 'glass', a: 'alert' }
const icons = {
  read: sprite(
    ['.......', 'bbb.bbb', 'bwwbwwb', 'bwwbwwb', 'bwwbwwb', 'bbbbbbb', '.......'],
    ICON),
  edit: sprite(
    ['.....rr', '....yrr', '...yyy.', '..yyy..', '.yyy...', 'kss....', 'kk.....'],
    ICON),
  bash: sprite(
    ['kkkkkkk', 'kgkkkkk', 'kkgkkkk', 'kgkkkkk', 'kkkgggk', 'kkkkkkk', '.......'],
    ICON),
  web: sprite(
    ['..bbb..', '.bcbcb.', 'bbbbbbb', 'bcbcbcb', 'bbbbbbb', '.bcbcb.', '..bbb..'],
    ICON),
  agent: sprite(
    ['.ss.ss.', '.ss.ss.', '.......', 'bbbrrr.', 'bbbrrr.', 'bbbrrr.', '.......'],
    ICON),
  ask: sprite(
    ['.aaaaa.', 'aa...aa', '....aa.', '...aa..', '...aa..', '.......', '...aa..'],
    ICON),
  other: sprite(
    ['.......', '.......', '..ooo..', '..ooo..', '..ooo..', '.......', '.......'],
    ICON),
}
const alert = sprite(
  ['.ooo.', 'oaaao', 'oaaao', 'oaaao', 'oaaao', 'oAAAo', '.ooo.', 'oaaao', '.ooo.'],
  { o: 'outline', a: 'alert', A: 'alertDark' })
const bubbleTail = sprite(
  ['owwwo', '.owo.', '..o..'],
  { o: 'outline', w: 'white' })

export const SPRITES = {
  floorTile,
  floorWood,
  wallTop,
  wallSide,
  desk,
  monitorOff,
  monitorOn,
  monitorAlert,
  chair,
  person: { sit, type, lean, stand, walk },
  intern: { sit: internOf(sit), type: type.map(internOf), lean: internOf(lean), stand: internOf(stand), walk: walk.map(internOf) },
  beanie,
  crown,
  cap,
  plant,
  floorConcrete,
  sofa,
  coffeeTable,
  waterCooler,
  coffeeMachine,
  whiteboard,
  tree,
  tuft,
  bookshelf,
  window,
  sign,
  bubble: { tail: bubbleTail },
  icons,
  alert,
}

// 3×5 glyphs, upper case; lower case draws upper.
const F = (rows: string) => rows.split(',')
export const FONT: Record<string, string[]> = {
  ' ': F('...,...,...,...,...'),
  '!': F('.#.,.#.,.#.,...,.#.'),
  '"': F('#.#,#.#,...,...,...'),
  '#': F('#.#,###,#.#,###,#.#'),
  '$': F('.##,##.,.#.,.##,##.'),
  '%': F('#.#,..#,.#.,#..,#.#'),
  '&': F('.#.,#.#,.#.,#.#,.##'),
  "'": F('.#.,.#.,...,...,...'),
  '(': F('..#,.#.,.#.,.#.,..#'),
  ')': F('#..,.#.,.#.,.#.,#..'),
  '*': F('...,#.#,.#.,#.#,...'),
  '+': F('...,.#.,###,.#.,...'),
  ',': F('...,...,...,.#.,#..'),
  '-': F('...,...,###,...,...'),
  '.': F('...,...,...,...,.#.'),
  '/': F('..#,..#,.#.,#..,#..'),
  '0': F('###,#.#,#.#,#.#,###'),
  '1': F('.#.,##.,.#.,.#.,###'),
  '2': F('##.,..#,.#.,#..,###'),
  '3': F('##.,..#,.#.,..#,##.'),
  '4': F('#.#,#.#,###,..#,..#'),
  '5': F('###,#..,##.,..#,##.'),
  '6': F('.##,#..,###,#.#,###'),
  '7': F('###,..#,.#.,.#.,.#.'),
  '8': F('###,#.#,###,#.#,###'),
  '9': F('###,#.#,###,..#,##.'),
  ':': F('...,.#.,...,.#.,...'),
  ';': F('...,.#.,...,.#.,#..'),
  '<': F('..#,.#.,#..,.#.,..#'),
  '=': F('...,###,...,###,...'),
  '>': F('#..,.#.,..#,.#.,#..'),
  '?': F('##.,..#,.#.,...,.#.'),
  '@': F('.#.,#.#,#.#,#..,.##'),
  'A': F('.#.,#.#,###,#.#,#.#'),
  'B': F('##.,#.#,##.,#.#,##.'),
  'C': F('.##,#..,#..,#..,.##'),
  'D': F('##.,#.#,#.#,#.#,##.'),
  'E': F('###,#..,##.,#..,###'),
  'F': F('###,#..,##.,#..,#..'),
  'G': F('.##,#..,#.#,#.#,.##'),
  'H': F('#.#,#.#,###,#.#,#.#'),
  'I': F('###,.#.,.#.,.#.,###'),
  'J': F('..#,..#,..#,#.#,.#.'),
  'K': F('#.#,#.#,##.,#.#,#.#'),
  'L': F('#..,#..,#..,#..,###'),
  'M': F('#.#,###,###,#.#,#.#'),
  'N': F('#.#,###,###,###,#.#'),
  'O': F('.#.,#.#,#.#,#.#,.#.'),
  'P': F('##.,#.#,##.,#..,#..'),
  'Q': F('.#.,#.#,#.#,###,.##'),
  'R': F('##.,#.#,##.,#.#,#.#'),
  'S': F('.##,#..,.#.,..#,##.'),
  'T': F('###,.#.,.#.,.#.,.#.'),
  'U': F('#.#,#.#,#.#,#.#,.##'),
  'V': F('#.#,#.#,#.#,.#.,.#.'),
  'W': F('#.#,#.#,###,###,#.#'),
  'X': F('#.#,#.#,.#.,#.#,#.#'),
  'Y': F('#.#,#.#,.#.,.#.,.#.'),
  'Z': F('###,..#,.#.,#..,###'),
  '[': F('##.,#..,#..,#..,##.'),
  '\\': F('#..,#..,.#.,..#,..#'),
  ']': F('.##,..#,..#,..#,.##'),
  '^': F('.#.,#.#,...,...,...'),
  '_': F('...,...,...,...,###'),
  '`': F('#..,.#.,...,...,...'),
  '{': F('.##,.#.,##.,.#.,.##'),
  '|': F('.#.,.#.,.#.,.#.,.#.'),
  '}': F('##.,.#.,.##,.#.,##.'),
  '~': F('...,.##,##.,...,...'),
  '…': F('...,...,...,...,#.#'),
  '·': F('...,...,.#.,...,...'),
  '–': F('...,...,###,...,...'),
  '↻': F('.##,#.#,#..,#.#,.#.'),
}
