import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { RoomFile } from '../mod/types/index.d.ts'

export type IsAlive = (pid: number, procStart: string) => boolean

const FRESH_MS = 10_000
const ALIVE_CACHE_MS = 5_000

const collapse = (text: string) => text
  .replace(/\s+/g, ' ')
  .trim()

const aliveCache = new Map<string, { at: number; alive: boolean }>()

// A pid is the session's only while the process holding it started when the session's did.
export const processAlive: IsAlive = (pid, procStart) => {
  const key = `${pid} ${procStart}`
  const cached = aliveCache.get(key)
  if (cached && Date.now() - cached.at < ALIVE_CACHE_MS) return cached.alive
  let alive = false
  try {
    process.kill(
      pid,
      0)
    const started = execFileSync(
      'ps',
      ['-o', 'lstart=', '-p', String(pid)],
      { env: { ...process.env, TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
    alive = collapse(started) === collapse(procStart)
  } catch {
    alive = false
  }
  aliveCache.set(
    key,
    { at: Date.now(), alive })
  return alive
}

export const createRoomReader = (dir: string, isAlive: IsAlive = processAlive) => {
  const lastGood = new Map<string, RoomFile>()

  const parse = (file: string) => {
    try {
      const room = JSON.parse(readFileSync(
        join(
          dir,
          file),
        'utf8')) as RoomFile
      if (room.version === 1) lastGood.set(
        file,
        room)
    } catch {
      // Half written or unreadable: the last good parse stands.
    }
    return lastGood.get(file)
  }

  const read = (now: number): RoomFile[] => {
    let files: string[] = []
    try {
      files = readdirSync(dir).filter(file => file.endsWith('.json'))
    } catch {
      return []
    }
    for (const file of lastGood.keys())
      if (!files.includes(file)) lastGood.delete(file)
    const rooms: RoomFile[] = []
    for (const file of files) {
      const room = parse(file)
      if (!room) continue
      // No sessions entry matched: alive only while the mod keeps writing.
      if (room.pid === 0) {
        if (now - room.updatedAt < FRESH_MS) rooms.push(room)
        continue
      }
      if (isAlive(
        room.pid,
        room.procStart)) {
        rooms.push(room)
        continue
      }
      lastGood.delete(file)
      try {
        unlinkSync(join(
          dir,
          file))
      } catch {
        // Already gone.
      }
    }
    return rooms.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { read }
}
