import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type { RoomFile } from '../mod/types/index.d.ts'

export type Osascript = (script: string) => Promise<string>
export type FocusResult = { ok: true } | { ok: false; reason: string }
// The session's terminal device, and a way to write a title escape to it.
export type Tty = { of: (pid: number) => Promise<string | undefined>; write: (tty: string, text: string) => Promise<void> }

const osascript: Osascript = script => new Promise((resolve, reject) => execFile(
  'osascript',
  ['-e', script],
  { timeout: 5_000 },
  (error, stdout, stderr) => (error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout))))

const sessionTty: Tty = {
  of: pid => new Promise(resolve => execFile(
    'ps',
    ['-o', 'tty=', '-p', String(pid)],
    (error, stdout) => {
      const tty = stdout.trim()
      resolve(!error && tty && tty !== '??' ? `/dev/${tty}` : undefined)
    })),
  write: (tty, text) => writeFile(
    tty,
    text),
}

// One line per Ghostty terminal: id, title and working directory, tab-separated.
// `tab` inside the tell block is Ghostty's tab class, so the separator is set before it.
const LIST = `set sep to character id 9
tell application "Ghostty"
  set out to ""
  repeat with t in terminals
    set out to out & (id of t) & sep & (name of t) & sep & (working directory of t) & linefeed
  end repeat
  return out
end tell`

const quoted = (text: string) => `"${text.replace(/["\\]/g, '\\$&')}"`

const title = (text: string) => `\x1b]2;${text.replace(/[\x00-\x1f\x7f-\x9f]/g, '')}\x07`

const list = async (run: Osascript) => (await run(LIST))
  .split('\n')
  .map(line => line.split('\t'))
  .filter(([id]) => id)

// Sets a one-off title on the session's own tty, finds the Ghostty terminal showing it, then puts
// that terminal's title back. Ghostty's AppleScript names no tty or pid, so this is the exact match.
const byTty = async (room: RoomFile, run: Osascript, tty: Tty, before: string[][]) => {
  const device = await tty.of(room.pid)
  if (!device) return undefined
  const token = `agent-room-${randomUUID()}`
  await tty.write(
    device,
    title(token))
  let id: string | undefined
  for (let attempt = 0; attempt < 10 && !id; attempt++) {
    id = (await list(run)).find(([, name]) => name === token)?.[0]
    if (!id) await new Promise(resolve => setTimeout(
      resolve,
      100))
  }
  const old = before.find(([tid]) => tid === id)?.[1]
  await tty
    .write(
      device,
      title(old ?? 'Claude Code'))
    .catch(() => undefined)
  return id
}

export const focusSession = async (room: RoomFile, run: Osascript = osascript, tty: Tty = sessionTty): Promise<FocusResult> => {
  try {
    const before = await list(run)
    const inFolder = before.filter(([, , cwd]) => cwd?.replace(/\/$/, '') === room.cwd.replace(/\/$/, ''))
    const named = inFolder.filter(([, name]) => name.includes(room.name))
    const id = await byTty(
      room,
      run,
      tty,
      before).catch(() => undefined)
      ?? (inFolder.length === 1 ? inFolder[0][0] : named.length === 1 ? named[0][0] : undefined)
    if (!id) return {
      ok: false,
      reason: inFolder.length
        ? `Can't tell which Ghostty tab runs ${room.name}: ${inFolder.length} tabs are in ${room.cwd}`
        : `No Ghostty tab found for ${room.name} (${room.cwd})`,
    }
    await run(`tell application "Ghostty" to focus terminal id ${quoted(id)}`)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: `Ghostty would not switch tabs: ${(error as Error).message}` }
  }
}
