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

- **Fit:** the layout tries every combination of room columns and desks per row, and keeps the one that lets the office be drawn largest in the tab. Ten rooms fit a 120×35 tab, and draw at 3× in a 200×50 Retina tab. An office too big even at 1× is shrunk by the same factor on both axes.
- **Interns:** subagents are drawn as interns, in a green striped polo and an orange beanie. The main agent wears its own shirt colour and a crown.

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
- **Fonts:** the status sign and the activity or details board use a 5×7 bitmap font with lowercase and two descender rows (`viewer/font.ts`, 6 px advance, 11 px lines). Bubbles, name tags and room names use the 3×5 uppercase font. A glyph a font lacks draws as `?`.
- **Snapshot:** `node viewer/snapshot.ts <fixture> <out.png> [w h scale]` renders a fixture for checking the art.

**Key files:** `viewer/office.ts`, `viewer/sprites.ts`, `viewer/font.ts`, `viewer/test/font.test.ts`, `viewer/canvas.ts`, `viewer/png.ts`, `viewer/snapshot.ts`, `viewer/test/office.test.ts`, `viewer/test/fixtures/busy.json`

### Generated art

`art/` holds nine generated sheets (`boss`, `interns`, `desks`, `tiles`, `building`, `breakroom`, `icons`, `ui`, `badges`; prompts in `art/prompts.json`). At startup `loadArt` turns them into the office's sprites; if any sheet is missing or unreadable, the office keeps its drawn-in-code look.

- **Reading:** `viewer/png.ts` reads 8-bit RGB and RGBA PNGs.
- **Keying and finding sprites:** `viewer/sheet.ts` keys out the green background, keeping plant greens, and finds each sprite as a blob of opaque pixels rather than assuming a grid. Stacked pieces up to 48 px apart and side-by-side pieces up to 16 px apart merge, so a `?` keeps its dot and a pair of heads stays one icon. Sprites come back in reading order.
- **Shrinking:** each sprite is shrunk to its slot by averaging, and a pixel stays opaque when half its area was, so edges stay hard.
  - seated workers: 44×38, each a whole desk station
  - standing and walking figures: 14×24
  - floor tiles: 16×16, cut from the middle of each tile
  - furniture: sized per piece
  - icons: 7×7
- **Panels:** the sign, chalkboard, clipboard and speech bubble are stretched as nine-slices (`drawNine`).
- **Who wears what:**
  - the boss (main agent): 4 hair styles, picked per agent, with the magenta shirt recolored to the session's colour (`recolor`, cached per frame image)
  - interns (subagents): 4 looks
- **Breaks:** a worker on break leaves an empty desk with its chair turned away.

**Key files:** `viewer/art.ts`, `viewer/sheet.ts`, `viewer/png.ts`, `viewer/canvas.ts` (`drawImage`, `drawNine`), `art/`, `viewer/test/art.test.ts`, `viewer/test/sheet.test.ts`, `viewer/test/png.test.ts`

### Breaks

- **Going on break:** an agent that has waited (`idle`) for 5 minutes gets up and walks to the kitchen or the lounge (breaks alternate between them), leaving an empty chair and a `(break)` name tag at its desk. The 5 minutes count from the status-change time `since`, which the mod stamps. It walks down to the corridor under its room, along it, then into the room over 2 s, and stands there.
- **Coming back:** clicking its room calls it back (`recall` answers when it will be seated). It walks to its seat and stays at least another 5 minutes. An agent that starts working again walks straight back.

**Key files:** `viewer/breaks.ts`, `viewer/test/breaks.test.ts`, `viewer/sprites.ts` (`person.stand`, `person.walk`)

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
- **Keys:** clicking anywhere in a session's room calls that room's agents back from their breaks. Once the last one is seated (2 s, or at once when nobody was away), it opens the session's terminal tab. Tab or the arrows select a desk and show its details on a clipboard, where Enter goes to the session. Esc clears the selection, and `q` or ctrl+c quits. Terminal replies and unmapped keys (`CSI …`) are swallowed.
- **Go to session:** with a desk selected, Enter brings that session's own Ghostty tab to the front through Ghostty 1.3's AppleScript (`viewer/focus.ts`). The exact tab comes from a title handshake. The viewer finds the session's tty (`ps -o tty= -p <pid>`) and writes a one-off title to it. It asks Ghostty which terminal now shows that title, puts that terminal's old title back, and runs `focus terminal id …`. Without a tty, it falls back to the only tab in the session's folder, or the only one titled with the session name. It never guesses between several. Failures show as the first details line.
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
- **Go to session finds the tab by a title handshake on the session's tty.** Ghostty's AppleScript exposes no tty or pid, and several sessions often share a folder with identical `✳ Claude Code` titles, so matching by folder alone picked the wrong tab. The handshake writes two short title escapes to the session's tty; one could interleave with the session's own output, at worst garbling one frame of its screen.
