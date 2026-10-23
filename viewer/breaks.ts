import type { RoomFile } from '../mod/types/index.d.ts'
import type { Box, Desk, Office } from './office.ts'

export const BREAK_AFTER_MS = 5 * 60_000
export const WALK_MS = 2_000

type Point = { x: number; y: number }
// An agent drawn away from its chair: walking (to the kitchen or back) or standing in the kitchen.
export type Figure = Point & { isWalking: boolean; isFacingLeft: boolean }
type State = { isAway: boolean; recalledAt: number; walk?: { path: Point[]; start: number } }

export const agentKey = (sessionId: string, agentId: string | null) => `${sessionId}:${agentId ?? ''}`

// Where a sitter's sprite stands at its desk.
const seat = (desk: Desk): Point => ({ x: desk.x + desk.w / 2 - 5, y: desk.y + 27 })

const spot = (room: Box, i: number): Point => {
  const perRow = Math.max(
    1,
    Math.floor((room.w - 60) / 14))
  return { x: room.x + 52 + (i % perRow) * 14, y: room.y + 30 + Math.floor(i / perRow) * 18 }
}

const inside = (p: Point, b: Box) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h

// Down to the corridor under the room it leaves, along it, then up or down to the destination.
const route = (office: Office, from: Point, to: Point): Point[] => {
  const leaving = office.rooms.find(r => inside(
    from,
    r))
  const y = leaving ? leaving.y + leaving.h + 2 : from.y
  return [
    from,
    { x: from.x, y },
    { x: to.x, y },
    to,
  ]
}

const along = (path: Point[], t: number): Point & { isFacingLeft: boolean } => {
  const legs = path.slice(1).map((p, i) => ({ a: path[i], b: p, len: Math.abs(p.x - path[i].x) + Math.abs(p.y - path[i].y) }))
  let left = t * legs.reduce((sum, leg) => sum + leg.len, 0)
  for (const leg of legs) {
    if (left <= leg.len || leg === legs.at(-1)) {
      const k = leg.len ? Math.min(1, left / leg.len) : 1
      return {
        x: Math.round(leg.a.x + (leg.b.x - leg.a.x) * k),
        y: Math.round(leg.a.y + (leg.b.y - leg.a.y) * k),
        isFacingLeft: leg.b.x < leg.a.x,
      }
    }
    left -= leg.len
  }
  return { ...path.at(-1)!, isFacingLeft: false }
}

export const createBreaks = () => {
  const states = new Map<string, State>()

  const update = (office: Office, rooms: RoomFile[], now: number) => {
    const figures = new Map<string, Figure>()
    // Breaks alternate between the kitchen and the lounge.
    const rest = ['kitchen', 'lounge']
      .map(kind => office.rooms.find(r => r.kind === kind))
      .filter((r): r is Box & { kind: string } => Boolean(r))
    if (!rest.length) return figures
    let spots = 0
    for (const desk of office.desks) {
      const agent = rooms
        .find(r => r.sessionId === desk.sessionId)
        ?.agents.find(a => a.id === desk.agentId)
      if (!agent) continue
      const key = agentKey(
        desk.sessionId,
        desk.agentId)
      const state = states.get(key) ?? { isAway: false, recalledAt: 0 }
      states.set(
        key,
        state)
      const isAway = agent.status === 'idle' && now - Math.max(agent.since, state.recalledAt) >= BREAK_AFTER_MS
      const home = seat(desk)
      const away = spot(
        rest[spots % rest.length],
        Math.floor(spots / rest.length))
      if (isAway) spots++
      if (isAway !== state.isAway) {
        // A recall starts the walk back when the click came, not on the next frame.
        const start = !isAway && state.recalledAt > (state.walk?.start ?? 0) ? state.recalledAt : now
        state.walk = { path: isAway ? route(office, home, away) : route(office, away, home), start }
        state.isAway = isAway
      }
      const walked = state.walk && (now - state.walk.start) / WALK_MS
      if (state.walk && walked !== undefined && walked < 1) figures.set(
        key,
        { ...along(state.walk.path, Math.max(0, walked)), isWalking: true })
      else if (isAway) figures.set(
        key,
        { ...away, isWalking: false, isFacingLeft: false })
    }
    return figures
  }

  // The developer clicked: the agent comes back and stays another 5 minutes. Answers when it is seated.
  const recall = (key: string, now: number) => {
    const state = states.get(key)
    if (!state) return now
    state.recalledAt = now
    return state.isAway ? now + WALK_MS : now
  }

  return { update, recall }
}
