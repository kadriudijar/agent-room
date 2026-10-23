# Agent Room

## Purpose

A full-screen 8-bit pixel office in a Ghostty tab showing every open Claude Code session as a room. Each agent and subagent sits at a desk with its current action shown live. The office also shows account usage, an activity log and desk details.

## Architecture

There are two parts, joined by files:

- **`mod/`**: a Claude Code mod (function-hooks plugin) that runs in every session. It writes its session's status to `~/.claude/agent-room/<sessionId>.json` (under `CLAUDE_CONFIG_DIR` when set).
- **`viewer/`**: `claude-room`, a standalone Node program that reads every status file and draws the office.

The status file's shape is `RoomFile` in `mod/types/index.d.ts`, which both parts share.

## Features

### Session status mod

- **Hidden sessions:** spare (pre-warmed) sessions and SDK-run ones, such as claude-mem's observers, write no room, because the developer didn't open them. The entry is re-read every 5 s, so a `/rename` or a spare being claimed shows within 5 s.
- **On `session.start`:** the mod finds its session's entry in Claude Code's sessions folder (`~/.claude/sessions/<pid>.json`, matched by session id). It keeps that entry's `pid`, `procStart` and `name`. With no entry it uses `pid: 0` and the first 8 characters of the session id as the name.
- **Every 300 ms:** it folds `$.agent.list()` into the desks. Main is always first. Running or pending subagents count as `running`, waiting or idle ones as `idle`, and the rest as `done`, which leaves the office 10 s after finishing. It writes the file only when its content changed.
- **Each `tool.call`:** from main or from any subagent, it sets that desk's action and logs it. The log holds the newest 50 entries.
- **Actions** are one-line labels of at most 80 characters, each with an icon:
  - Read, Grep and Glob show `read` with the file name or pattern.
  - Edit, Write and NotebookEdit show `edit` with the file name.
  - Bash shows `bash` with `$ <first line>`.
  - WebFetch and WebSearch show `web` with the host or query.
  - Agent shows `agent` with its description.
  - AskUserQuestion shows `ask` with `Asking you`.
- **Needs you:** a desk shows it while a permission ask (a `tool.check` verdict of `ask`) or an `AskUserQuestion` waits. It clears when that call settles, and main's clears on `turn.complete`.
- **Usage:** the 5-hour and weekly rate limits come from `session.measure`, plus a refresh every 60 s.
- **On `session.end`:** the file is removed.
- **Safety:** the mod is display only. Every hook passes its event on unchanged, and failures are swallowed.

**Key files:** `mod/hooks/register.ts`, `mod/types/index.d.ts`, `mod/.claude-plugin/plugin.json`, `mod/tests/room.test.ts`

### Viewer: reading rooms

- **Reading:** `createRoomReader(dir).read(now)` returns the live rooms in `~/.claude/agent-room/`, sorted by name.
- **Partial files:** a file it catches half-written or unreadable keeps its last good parse.
- **Liveness:** a room counts as live while its pid exists and the process's start time, from `TZ=UTC ps -o lstart=`, equals the file's `procStart`. That catches pid reuse. Checks are cached for 5 s.
- **Cleanup:** a dead room's file is deleted. A room with `pid: 0` counts only while it was updated in the last 10 s, and is never deleted.

**Key files:** `viewer/rooms.ts`, `viewer/test/rooms.test.ts`

### Office drawing

- **Rooms:** `layoutOffice(rooms, width, height)` places one room per session in a grid with `ceil(sqrt(n))` columns. Rooms are separated by 16 px corridors.
- **Seating:** desks are 64×56 px and seated depth first, so every helper sits right after the agent that spawned it.
- **Size:** the desks per row are chosen so the office's shape matches the screen's. The office grows past `width × height` rather than overlap.
- **No sessions:** with no rooms, one empty room shows a `NO SESSIONS` sign.
- **Drawing:** `drawOffice(office, rooms, tick, selected)` paints all the art in code (`viewer/sprites.ts`) at 1× logical scale:
  - grass with scattered trees, cream-tile or wood floors, a navy wall top with the session name and a window, and a plant per room
  - per desk: a monitor, a desk, a character seen from behind on a chair, and a name tag
  - main wears a crown; helpers wear a cap
- **Animation:**
  - running agents type, with code scrolling on their screen
  - idle agents lean back with the screen off
  - an agent that needs you gets a red `!` screen and a red `!` above it, blinking at 1 Hz
- **Bubbles:** each bubble shows the action's icon and label, cut to fit.
- **Snapshot:** `node viewer/snapshot.ts <fixture> <out.png> [w h scale]` renders a fixture for checking the art.

**Key files:** `viewer/office.ts`, `viewer/sprites.ts`, `viewer/canvas.ts`, `viewer/png.ts`, `viewer/snapshot.ts`, `viewer/test/office.test.ts`, `viewer/test/fixtures/busy.json`

### claude-room (full screen in Ghostty)

- **Startup:** `viewer/claude-room.ts` switches to the alternate screen, turns on mouse reporting, and probes for kitty graphics. If the probe fails it prints `claude-room needs a terminal with kitty graphics (Ghostty, kitty).` and exits 1.
- **Each frame (every 200 ms):**
  - it reads the rooms
  - picks the largest whole-number scale (up to 6×) at which the office fills the space between the header row and the text rows
  - draws and upscales the office with nearest-neighbour scaling, so pixels stay crisp
  - sends it as a PNG with the kitty graphics protocol, as image id 1 replaced in place, only when the bytes changed
- **Text rows:**
  - row 1 is the header: rooms, agents, working, helpers, needs you, and 5-hour and weekly usage with reset countdowns, from the most recently updated room
  - below the image is the activity log, newest first, or the selected desk's details: name, type, status, task or folder, and its last 5 actions
  - the last row is a key hint
- **Keys:** click a desk, or use Tab or the arrows, to select it. Esc clears the selection, and `q` or ctrl+c quits.
- **Go to session:** with a desk selected, Enter brings that session's Ghostty tab to the front through Ghostty 1.3's AppleScript (`viewer/focus.ts`). It lists every terminal's id, title and working directory, keeps the ones whose working directory is the session's `cwd`, and prefers the one whose title contains the session name. Then it runs `focus terminal id …`. When nothing matches, or osascript fails, the reason shows as the first details line.
- **Text safety:** every printed line drops C0/C1 control and bidi characters, so text from room files can't inject terminal escapes. The mod strips them from labels too.
- **Resize:** a resize re-queries the cell size and redraws. A tab under 40×15 shows only `Make this tab bigger`.
- **Speed:** a frame of a 3.5k-pixel-wide office takes about 110 ms, using 32-bit row copies and deflate level 1.

**Key files:** `viewer/claude-room.ts`, `viewer/terminal.ts`, `viewer/text.ts`, `viewer/focus.ts`, `viewer/test/focus.test.ts`, `viewer/test/terminal.test.ts`, `viewer/test/text.test.ts`

## Integrations

- **Claude Code mod API:** `tool.call`, `tool.check`, `turn.start`/`turn.complete`, `session.start`/`session.measure`/`session.end`, `$.agent.list()` and `$.fs`. Tests run with `claude plugin test mod`.
- **Ghostty (kitty graphics protocol):** PNG frames sent directly (`t=d`, `f=100`), plus SGR mouse reporting (modes 1000 and 1006) and the `CSI 16 t` cell-size query.
- **Ghostty AppleScript (1.3+):** `terminals` (`id`, `name`, `working directory`) and `focus`, run through `osascript`. Inside a `tell application "Ghostty"` block, `tab` names Ghostty's tab class, so the field separator is `character id 9`, set outside the block.
- **Claude Code's sessions folder** (`~/.claude/sessions/<pid>.json`): an internal format, read for the session's pid, process start time and name.

## Setup

```bash
./install.sh             # links mod → ~/.claude/skills/agent-room, viewer/claude-room.ts → ~/.local/bin/claude-room
./install.sh --uninstall # removes only links into this repo
```

Sessions started after install write their rooms. Run `claude-room` in a tab of the existing Ghostty (cmd+T), not a new Ghostty instance.

**Key files:** `install.sh`, `README.md`

## Key Decisions

- **One status file per session.** No two sessions write the same file, so nothing contends.
- **Plain writes, not temp file plus rename.** The mod API has no rename. The viewer keeps the last good parse of a file it catches half-written.
- **Agent Room lives in its own repo.** It is not part of the shared `claude` config repo.
- **Go to session matches tabs by working directory.** Ghostty's AppleScript exposes no tty or pid, so the session's `cwd` picks the tab, with its name in the title as the tiebreak. Two untitled sessions in one folder may pick the wrong one of the two.
