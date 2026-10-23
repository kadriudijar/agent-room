import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { RoomFile } from '../../mod/types/index.d.ts'
import { createRoomReader, processAlive } from '../rooms.ts'

const NOW = 1_800_000_000_000

const room = (name: string, extra: Partial<RoomFile> = {}): RoomFile => ({
  version: 1,
  sessionId: name,
  name,
  cwd: '/x',
  pid: 4242,
  procStart: 'Fri Oct 23 18:38:20 2026',
  updatedAt: NOW,
  agents: [],
  usage: [],
  log: [],
  ...extra,
})

const dirWith = (...rooms: RoomFile[]) => {
  const dir = mkdtempSync(join(
    tmpdir(),
    'rooms-'))
  for (const r of rooms) writeFileSync(
    join(
      dir,
      `${r.sessionId}.json`),
    JSON.stringify(r))
  return dir
}

const ownStart = () => execFileSync(
  'ps',
  ['-o', 'lstart=', '-p', String(process.pid)],
  { env: { ...process.env, TZ: 'UTC' } })
  .toString()
  .trim()

test(
  'reads every live room sorted by name',
  () => {
    const reader = createRoomReader(
      dirWith(
        room('b'),
        room('a')),
      () => true)

    assert.deepEqual(
      reader
        .read(NOW)
        .map(r => r.name),
      ['a', 'b'])
  })

test(
  'keeps the last good parse when a file is half written',
  () => {
    const dir = dirWith(room('a', { cwd: '/first' }))
    const reader = createRoomReader(
      dir,
      () => true)
    reader.read(NOW)
    writeFileSync(
      join(
        dir,
        'a.json'),
      '{"version":1,"ses')

    assert.equal(
      reader.read(NOW)[0]?.cwd,
      '/first')
  })

test(
  "deletes a dead session's file",
  () => {
    const dir = dirWith(room('a'))
    const reader = createRoomReader(
      dir,
      () => false)

    assert.deepEqual(
      reader.read(NOW),
      [])
    assert.equal(
      existsSync(join(
        dir,
        'a.json')),
      false)
  })

test(
  'deletes a file whose pid was reused',
  () => {
    assert.equal(
      processAlive(
        process.pid,
        'Mon Jan  1 00:00:00 2001'),
      false)
  })

test(
  'keeps a live session',
  () => {
    const dir = dirWith(room('a', { pid: process.pid, procStart: ownStart() }))
    const reader = createRoomReader(dir)

    assert.equal(
      reader.read(NOW).length,
      1)
    assert.equal(
      existsSync(join(
        dir,
        'a.json')),
      true)
  })

test(
  'pid 0 is alive only while fresh',
  () => {
    const dir = dirWith(
      room('fresh', { pid: 0, updatedAt: NOW - 1_000 }),
      room('stale', { pid: 0, updatedAt: NOW - 11_000 }))
    const reader = createRoomReader(dir)

    assert.deepEqual(
      reader
        .read(NOW)
        .map(r => r.name),
      ['fresh'])
    assert.equal(
      existsSync(join(
        dir,
        'stale.json')),
      true)
  })
