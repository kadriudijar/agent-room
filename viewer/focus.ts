import { execFile } from 'node:child_process'
import type { RoomFile } from '../mod/types/index.d.ts'

export type Osascript = (script: string) => Promise<string>
export type FocusResult = { ok: true } | { ok: false; reason: string }

const osascript: Osascript = script => new Promise((resolve, reject) => execFile(
  'osascript',
  ['-e', script],
  { timeout: 5_000 },
  (error, stdout, stderr) => (error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout))))

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

// Ghostty 1.3's AppleScript: the terminal in the session's folder, the one titled with its name when several are.
export const focusSession = async (room: RoomFile, run: Osascript = osascript): Promise<FocusResult> => {
  try {
    const terminals = (await run(LIST))
      .split('\n')
      .map(line => line.split('\t'))
      .filter(([id, , cwd]) => id && cwd?.replace(/\/$/, '') === room.cwd.replace(/\/$/, ''))
    const terminal = terminals.find(([, title]) => title.includes(room.name)) ?? terminals[0]
    if (!terminal) return { ok: false, reason: `No Ghostty tab found for ${room.name} (${room.cwd})` }
    await run(`tell application "Ghostty" to focus terminal id ${quoted(terminal[0])}`)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: `Ghostty would not switch tabs: ${(error as Error).message}` }
  }
}
