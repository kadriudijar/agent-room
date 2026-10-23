# Agent Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen 8-bit pixel office in a Ghostty tab that shows every open Claude Code session as a room, every agent and subagent at a desk with its live action, plus usage, an activity log, desk details and "go to session".

**Architecture:** A Claude Code mod (`mod/`) runs in every session. It writes one JSON status file per session into `~/.claude/agent-room/`. A standalone Node program (`viewer/`, run as `claude-room`) reads those files a few times a second, draws the office as RGBA pixels from sprites defined in code, encodes PNG frames and shows them with the kitty graphics protocol. Text lines (header, log, details) go in reserved rows above and below the image.

**Tech Stack:**
- Mod: TypeScript against the `claude-code` mod API, tested with `claude-code/testing` via `claude plugin test mod`.
- Viewer: Node 24 running `.ts` files directly (native type stripping), with no npm dependencies. `node:zlib` provides `deflateSync` and `crc32`. Tests use `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-agent-room-design.md`

**Mod API reference:**
- The bundled plugin-authoring skill: `reference.md`, `types/claude-code.d.ts` and `examples/`. Load the `plugin-authoring` skill to get its path.
- Working mods in `~/repos/claude/mods/`:
  - `usage-footer`, for the session name, usage and the test style.
  - `live-activity`, for the `tool.call` shapes per tool.

## Global Constraints

- Repo: `~/repos/agent-room`, branch `feat/agent-room`. Conventional commits, `feat:`/`fix:`/`chore:` only, with no `Co-Authored-By` trailer. Commit after every task.
- Status files: `~/.claude/agent-room/<sessionId>.json` (use `CLAUDE_CONFIG_DIR` in place of `~/.claude` when it is set).
- The mod is display only. Every hook passes `next(e)` through unchanged, every failure is swallowed (`.catch`), and nothing reaches the model.
- All art is drawn in code. No downloaded or licensed assets.
- Target: Ghostty on macOS, using the kitty graphics protocol. Any terminal that fails the graphics probe gets `claude-room needs a terminal with kitty graphics (Ghostty, kitty).` and exit code 1.
- Text never overlays the image.
- Run `/vertical-chain-formatter` on changed `.ts` files before each commit.
- Keep `Project.md` current: Purpose, Architecture, Features (with key files), Integrations, Key Decisions. Create it in Task 1, then update it in each task that changes behaviour.

## Review Focus

1. **Crowding.** A single session with 12 subagents, or 8 sessions at once, must keep every desk visible and not overlapping. Rooms grow or the grid adds rows. No desk may land off-image. *(Task 4 test `fits 8 rooms and 13 desks`.)*
2. **Resize.** Resizing the Ghostty tab mid-run should re-lay out and refit the image on the next frame, with no stale image or garbage left behind. A tab too small to draw should show `Make this tab bigger` and nothing else. *(Task 5 tests `layout follows a new size`, `tiny tab shows the bigger message`.)*
3. **Half-written or corrupt status files.** These must never crash the viewer, and must never blank a room that was drawn before. Keep the last good parse. *(Task 2 test `keeps the last good parse when a file is half written`.)*
4. **Long or odd labels.** A multi-line bash command, a 300-character path, emoji or non-ASCII text must be one line, truncated with `…` for terminal text, and in the pixel font unknown glyphs draw as `?`. *(Task 1 test `labels are one line and capped at 80 chars`; Task 3 test `unknown glyphs draw as ?`.)*
5. **Crashed sessions and pid reuse.** A file left by a session that died without `session.end`, or whose pid now belongs to another process, disappears from the office and is deleted. A live session's file is never deleted. *(Task 2 tests `deletes a dead session's file`, `deletes a file whose pid was reused`, `keeps a live session`.)*

---

## Shared types

`mod/types/index.d.ts` defines the status file. Task 1 creates it, and the viewer imports it with `import type` (type stripping erases the import).

```ts
export type Icon = 'read' | 'edit' | 'bash' | 'web' | 'agent' | 'ask' | 'other'
export type Action = { icon: Icon; label: string }            // label: one line, ≤ 80 chars
export type DeskAgent = {
  id: string | null          // null = the session's main agent
  parentId: string | null    // null = spawned by main (or is main)
  name: string               // main: 'main'; subagent: AgentInfo.name ?? AgentInfo.type
  type: string               // main: 'main'
  description: string        // main: ''
  status: 'running' | 'idle' | 'done'
  needsYou: boolean
  action: Action | null
}
export type LogEntry = { at: number; agentId: string | null; icon: Icon; label: string }
export type Usage = { kind: 'five_hour' | 'seven_day'; percent: number; resetsAt?: string }
export type RoomFile = {
  version: 1
  sessionId: string
  name: string               // sessions-entry name, else first 8 chars of sessionId
  cwd: string
  pid: number                // from ~/.claude/sessions/<pid>.json matched by sessionId
  procStart: string          // that entry's procStart (UTC, e.g. "Fri Oct 23 18:38:20 2026")
  updatedAt: number
  agents: DeskAgent[]        // agents[0] is main
  usage: Usage[]
  log: LogEntry[]            // newest last, at most 50
}
```

---

### Task 1: Mod writes the session's status file

**Files:**
- Create: `mod/.claude-plugin/plugin.json` (`{ "name": "agent-room", "version": "0.1.0", "description": "Writes this session's agents and their actions for claude-room", "types": "./types/index.d.ts" }`)
- Create: `mod/hooks/hooks.json` (`{ "modules": ["./register.ts"] }`)
- Create: `mod/hooks/register.ts`
- Create: `mod/types/index.d.ts` (Shared types above)
- Create: `mod/tests/room.test.ts`
- Create: `Project.md`, `.gitignore` (`node_modules/`, `*.png`)

**Interfaces:**
- Produces: the `RoomFile` JSON at `<configDir>/agent-room/<sessionId>.json`, plus `actionOf(tool: string, input: unknown): Action` exported from `register.ts`.

**Behaviour to implement:**
- **`session.start`:**
  - Resolve the config dir, the session id, and the sessions entry. Use the same lookup as `usage-footer`'s `sessionName`, but keep `pid`, `procStart` and `name` from the entry. If there is no entry, still write the file with `pid: 0`. The viewer treats `pid: 0` as alive only while `updatedAt` is under 10 s old.
  - Start `$.clock.every(300, tick)`.
- **`tick`:** refresh subagents from `$.agent.list()`. Map `AgentInfo.status`: running → `running`, idle → `idle`, anything else → `done`. Drop `done` agents 10 s after they finish. Serialise the `RoomFile` and `$.fs.write` it only when the text differs from the last write, ignoring `updatedAt` in that comparison.
- **`tool.call` (all loops):**
  - Set the owning agent's `action = actionOf(e.tool, e.input)` and `status = 'running'`, and push a `LogEntry`. The owning agent is `e.agentId ?? null`.
  - Then `try { return await next(e) } finally { agent.needsYou = false }`.
  - For `AskUserQuestion`, set `needsYou = true` before awaiting.
- **`tool.check`:** `const verdict = await next(e)`. When `verdict.decision === 'ask'`, set the owning agent's `needsYou = true`, then return `verdict`.
- **`turn.start` / `turn.complete`** with no `agentId`: set main's `status` to `running` or `idle`. `turn.complete` also clears main's `needsYou` and `action`.
- **Usage:** `session.measure` and a 60 s `$.clock.every` refresh `usage` from `$.session.usage().rateLimits`, keeping `five_hour` and `seven_day`.
- **`session.end`:** stop the timers and `$.process.run(['rm', '-f', file])`.
- **`actionOf`:**
  - `Read`, `Grep` and `Glob` give `read` + the path's basename or pattern.
  - `Edit`, `Write` and `NotebookEdit` give `edit` + basename.
  - `Bash` gives `bash` + `$ <first line of command>`.
  - `WebFetch` gives `web` + host; `WebSearch` gives `web` + query.
  - `Agent` gives `agent` + description.
  - `AskUserQuestion` gives `ask` + `Asking you`.
  - Anything else gives `other` + tool name.
  - Labels are collapsed to one line (whitespace runs become one space) and cut to 80 chars, ending with `…`.

- [ ] **Step 1: Write the failing tests in `mod/tests/room.test.ts`.** Follow `~/repos/claude/mods/usage-footer/tests/footer.test.tsx`. Stub `fs.write` so it captures the path and text, and stub `fs.list`/`fs.read` to serve a sessions entry `{ pid: 4242, sessionId: <id>, procStart: 'Fri Oct 23 18:38:20 2026', name: 'profiles-36' }`.
  - `writes the room file named by session id`: path ends `/agent-room/<id>.json`; parsed `name === 'profiles-36'`, `pid === 4242`, `agents[0].id === null`.
  - `a Read call shows on main's desk and in the log`: after `$.tool.call` Read `{ file_path: '/a/b/api.ts' }`, `agents[0].action` deep-equals `{ icon: 'read', label: 'api.ts' }` and the last log entry has `agentId: null`.
  - `a subagent's call lands on its own desk`: stub `agent.list` with `[{ id: 'a1', type: 'Explore', description: 'find tests', status: 'running' }]`. A Bash call with `agentId: 'a1'`, command `'npm test\nmore'`, gives the `a1` desk `action.label === '$ npm test'` and `parentId === null`.
  - `needs you is set while a permission ask waits and cleared after`: a `tool.check` verdict of `{ decision: 'ask' }` gives `needsYou === true`. Once that call's `tool.call` resolves, `needsYou === false`.
  - `labels are one line and capped at 80 chars`: `actionOf('Bash', { command: 'x'.repeat(300) }).label.length === 80`, and it ends with `…`.
  - `log keeps the newest 50`: after 60 calls, `log.length === 50` and the last entry is the 60th.
  - `the file is removed on session end`: `process.run` is called with `['rm', '-f', <path>]`.
- [ ] **Step 2: Run `claude plugin test mod`.** Expected: FAIL (no `register.ts`).
- [ ] **Step 3: Implement `mod/hooks/register.ts`** as described above. Keep state in module variables plus the file. This mod draws nothing, so `$.state` isn't needed.
- [ ] **Step 4: Run `claude plugin test mod`.** Expected: all pass.
- [ ] **Step 5: Write `Project.md`** (Purpose, Architecture, Features → "Session status mod" with key files, Integrations → Claude Code mod API and `~/.claude/sessions`, Key Decisions → one file per session so nothing contends). Run `/vertical-chain-formatter` on `mod/hooks/register.ts` and `mod/tests/room.test.ts`, then commit with `feat(mod): write each session's agents to a status file`.

### Task 2: Viewer reads live rooms

**Files:**
- Create: `viewer/rooms.ts`
- Create: `viewer/test/rooms.test.ts`

**Interfaces:**
- Consumes: `RoomFile` from `../mod/types/index.d.ts`.
- Produces:
  - `type IsAlive = (pid: number, procStart: string) => boolean`
  - `function processAlive(pid: number, procStart: string): boolean`. It uses `process.kill(pid, 0)`, then `TZ=UTC ps -o lstart= -p <pid>` (via `execFileSync`), and compares that to `procStart` with whitespace collapsed. Results are cached per pid for 5 s.
  - `function createRoomReader(dir: string, isAlive?: IsAlive): { read(now: number): RoomFile[] }`. It returns live rooms sorted by `name`.

- [ ] **Step 1: Write the failing tests in `viewer/test/rooms.test.ts`** (`node:test` + `node:assert/strict`). Each test uses a temp dir and an injected `isAlive`.
  - `reads every live room sorted by name`: files for `b` and `a` give names `['a', 'b']`.
  - `keeps the last good parse when a file is half written`: read a good file, overwrite it with `'{"version":1,"ses'`, read again, and the room is still there with its old content.
  - `deletes a dead session's file`: `isAlive` returns false, the room is gone, and the file no longer exists.
  - `deletes a file whose pid was reused`: `processAlive` with the current pid and a wrong `procStart` returns false. This exercises the real function.
  - `keeps a live session`: `processAlive(process.pid, <its real lstart under TZ=UTC>)` returns true, and the file stays.
  - `pid 0 is alive only while fresh`: a file with `updatedAt = now - 11_000` is skipped and not deleted.
- [ ] **Step 2: Run `node --test viewer/test/rooms.test.ts`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement `viewer/rooms.ts`.** Use `readdirSync`/`readFileSync`/`unlinkSync` and a `Map<file, RoomFile>` of last good parses. Ignore files that aren't `.json`.
- [ ] **Step 4: Run `node --test viewer/test/rooms.test.ts`.** Expected: PASS.
- [ ] **Step 5:** Format, update `Project.md` (Features → "Viewer: reading rooms"), and commit with `feat(viewer): read live session rooms`.

### Task 3: Pixel canvas, PNG and sprites

**Files:**
- Create: `viewer/canvas.ts`
- Create: `viewer/png.ts`
- Create: `viewer/sprites.ts`
- Create: `viewer/test/canvas.test.ts`

**Interfaces:**
- Produces:
  - `type Canvas = { width: number; height: number; data: Uint8Array }`. The data is RGBA.
  - `createCanvas(w, h, rgb = PALETTE.grass): Canvas`
  - `fillRect(c, x, y, w, h, rgb)`
  - `drawSprite(c, sprite: Sprite, x, y)`
  - `drawText(c, text: string, x, y, rgb): number`, which returns the width it drew in px.
  - `encodePng(c: Canvas): Buffer` in `png.ts`. It uses colour type 6, filter 0 per row, `deflateSync`, and `zlib.crc32` for chunk CRCs.
  - `sprites.ts` exports:
    - `PALETTE: Record<string, [number, number, number]>`
    - `type Sprite = { w: number; h: number; px: (string | null)[] }`, where each entry is a palette key or null for transparent
    - `sprite(rows: string[], key: Record<string, string>): Sprite`, which takes rows of chars, `.` meaning transparent
    - `SPRITES`, with: `floorWood`, `floorTile`, `wallTop`, `wallSide`, `desk`, `monitorOff`, `monitorOn[2]`, `chair`, `plant`, `bookshelf`, `window`, `sign`, `person` (keyed by body colour, poses `sit`, `type[2]` and `lean`), `bubble` (9-slice corners), `icons` (`read`, `edit`, `bash`, `web`, `agent`, `ask`, `other`, each 7×7) and `alert` (`!`)
    - `FONT`: 4×6 glyphs for ASCII 32–126 plus `?`
  - **Sprite sizes:** 16 px per tile and a 24×20 desk unit, at 1× logical scale. The viewer scales the finished canvas by an integer factor in Task 5 (`fitScale`), so sprites are authored at 1×.

- [ ] **Step 1: Write the failing tests in `viewer/test/canvas.test.ts`.**
  - `encodes a valid PNG`: bytes 0–7 equal the PNG signature. Writing a 3×2 canvas to a temp file and running `sips -g pixelWidth -g pixelHeight` on it reports width 3 and height 2.
  - `draws a sprite with transparency`: a 2×1 sprite `['a.']` on a black canvas leaves pixel (1,0) black and paints pixel (0,0).
  - `every sprite row matches its width`: for each sprite in `SPRITES`, `px.length === w * h`.
  - `unknown glyphs draw as ?`: `drawText` of `'é'` paints exactly the same pixels as `drawText` of `'?'`.
- [ ] **Step 2: Run `node --test viewer/test/canvas.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `canvas.ts`, `png.ts` and `sprites.ts`.**
  - The art direction is warm Habblaud-like: a cream tile floor, wood desks, a navy wall top, green plants, and characters with 6 body colours picked by a hash of the agent id.
  - Main agents wear a small crown pixel; helpers get a lanyard colour.
- [ ] **Step 4: Run `node --test viewer/test/canvas.test.ts`.** Expected: PASS.
- [ ] **Step 5:** Format and commit with `feat(viewer): add pixel canvas, png encoder and sprites`.

### Task 4: Office layout and drawing

**Files:**
- Create: `viewer/office.ts`
- Create: `viewer/snapshot.ts` (CLI: `node viewer/snapshot.ts <fixture.json> <out.png> [width height]`)
- Create: `viewer/test/office.test.ts`
- Create: `viewer/test/fixtures/busy.json` (`RoomFile[]` with 3 sessions, one of them with nested helpers, one needing you)

**Interfaces:**
- Consumes: `Canvas`, `drawSprite`, `drawText`, `SPRITES`, `PALETTE`; `RoomFile`.
- Produces:
  - `type Desk = { sessionId: string; agentId: string | null; x: number; y: number; w: number; h: number }`. Coordinates are in logical px.
  - `type RoomBox = { sessionId: string; x: number; y: number; w: number; h: number }`
  - `type Office = { width: number; height: number; rooms: RoomBox[]; desks: Desk[] }`
  - `layoutOffice(rooms: RoomFile[], width: number, height: number): Office`
  - `drawOffice(office: Office, rooms: RoomFile[], tick: number, selected: Desk | null): Canvas`

**Layout algorithm (decided):**
- Rooms sit in a grid with `cols = ceil(sqrt(n))`, separated by a 16 px corridor.
- Desks in a room are in depth-first order from main: each agent's children follow it, so helpers sit beside the agent that spawned them.
- Desks wrap in rows inside the room. When they don't fit, the desk unit stays fixed and the logical office grows; Task 5 then picks a smaller scale.
- With zero rooms, draw one empty room with a `sign` sprite and the text `no sessions`.

**Drawing:** each desk draws chair, desk, monitor and person.
- Running agents use `type` frames alternating on `tick`; idle agents use `lean`.
- A bubble above the desk holds the action icon and as much of the label as fits in 6 px font, clipped with `…`.
- `needsYou` draws the red `alert` sprite over the head, blinking at 2 Hz. It is drawn on top of the bubble.
- Each room's name is drawn on its wall top.
- A selected desk gets a 1 px yellow outline.

- [ ] **Step 1: Write the failing tests in `viewer/test/office.test.ts`.**
  - `seats helpers right after their parent`: in a room with main → `a1` → `a1b`, plus `a2`, the desk order is `[null, 'a1', 'a1b', 'a2']`.
  - `fits 8 rooms and 13 desks`: for 8 rooms, one with 13 agents, no two desks overlap and every desk lies inside `office.width × office.height` and inside its room box.
  - `an empty office still draws`: `layoutOffice([], 320, 200).rooms.length === 1`, and `drawOffice` returns a canvas of that size.
  - `needs you blinks`: the alert pixel differs between tick 0 and tick 5 at 10 fps (a 2 Hz blink).
- [ ] **Step 2: Run `node --test viewer/test/office.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `office.ts` and `snapshot.ts`.**
- [ ] **Step 4: Run the tests.** Expected: PASS. Then run `node viewer/snapshot.ts viewer/test/fixtures/busy.json /tmp/office.png 640 400` and look at the PNG with the Read tool. Desks, bubbles, helpers beside their parent and the alert should all be visible. Adjust the art until it reads well.
- [ ] **Step 5:** Format, update `Project.md` (Features → "Office drawing", key files), and commit with `feat(viewer): lay out and draw the office`.

### Task 5: `claude-room` in the terminal

**Files:**
- Create: `viewer/claude-room.ts` (shebang `#!/usr/bin/env node`, executable)
- Create: `viewer/terminal.ts`
- Create: `viewer/text.ts`
- Create: `viewer/test/text.test.ts`
- Create: `viewer/test/terminal.test.ts`

**Interfaces:**
- Consumes: `createRoomReader`, `processAlive`, `layoutOffice`, `drawOffice`, `encodePng`.
- Produces:
  - `terminal.ts`:
    - `probeGraphics(): Promise<boolean>`. It sends a kitty query (`\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\`) and waits up to 500 ms for `_Gi=31;OK`.
    - `querySize(): Promise<{ cols: number; rows: number; cellW: number; cellH: number }>`. It uses `CSI 16 t` for the cell size and `process.stdout.columns/rows` for the grid.
    - `showImage(png: Buffer, col: number, row: number, cols: number, rows: number): void`. It sends `a=T,f=100,i=1,c=<cols>,r=<rows>,q=2` with base64 chunks of 4096 and `m=1`/`m=0`, after moving the cursor. Reusing `i=1` replaces the image in place.
    - `parseInput(buf: Buffer): Input[]`, where `Input = { kind: 'click'; col: number; row: number } | { kind: 'key'; key: 'up' | 'down' | 'left' | 'right' | 'enter' | 'esc' | 'q' | 'tab' }`. Clicks are parsed from SGR mouse reports (`\x1b[<0;col;rowM`).
    - `enterScreen()` and `leaveScreen()`, covering the alt screen, hiding the cursor, enabling and disabling mouse modes 1000 and 1006, raw mode, and deleting images (`a=d`). `leaveScreen` also runs on SIGINT, SIGTERM and exit.
  - `text.ts`:
    - `headerLine(rooms: RoomFile[], now: number, cols: number): string`, for example `Agent Room · 3 rooms · 7 agents · 4 working · 4 helpers · 1 needs you · 5h 23% ↻2h14m · week 61% ↻3d4h`. Usage comes from the most recently updated room; missing usage shows `–`, as the usage footer does. The line is cut to `cols` with `…`.
    - `logLines(rooms: RoomFile[], count: number, cols: number): string[]`. These are the newest `count` entries across rooms, as `HH:MM:SS  <agent name>  <room name>  <icon glyph> <label>`.
    - `detailLines(room: RoomFile, agent: DeskAgent, cols: number): string[]`. These give the name, type, status, description, cwd, and the agent's last 5 log labels.
    - Icon glyphs: read 📖, edit ✏️, bash `$`, web 🌐, agent 🤝, ask ❓, other `·`.

**Main loop (decided):**
- At 10 fps:
  - read the rooms
  - lay out the office
  - pick the largest integer scale that fits the image area: all rows but 1 header row and 6 log rows, which become 8 rows while details are open
  - draw, encode and show the image only if the PNG bytes changed
  - write the text rows
- Use Tab or the arrows to move the selection through desks in layout order. A click maps cell → pixel → logical px → the desk under it. Esc clears the selection. `q` quits.
- Enter is wired in Task 6.
- Under 40 columns or 15 rows, clear the screen and print only `Make this tab bigger`.

- [ ] **Step 1: Write the failing tests in `viewer/test/text.test.ts` and `viewer/test/terminal.test.ts`.**
  - `header counts rooms, agents, working, helpers and needs you`: the busy fixture gives the exact expected string at `cols` 200 and a fixed `now`.
  - `header is cut to the width`: with `cols` 30, the result has length 30 and ends with `…`.
  - `log merges rooms newest first and is one line each`: a label containing `\n` comes out without it.
  - `parses an SGR click and arrow keys`: `parseInput(Buffer.from('\x1b[<0;12;5M\x1b[A'))` deep-equals `[{ kind: 'click', col: 12, row: 5 }, { kind: 'key', key: 'up' }]`.
  - `layout follows a new size`: `fitScale(office, { cols: 100, rows: 40, cellW: 10, cellH: 20 })` differs from the result at `cols: 200, rows: 60`. Export `fitScale(office: Office, size: Size): { scale: number; cols: number; rows: number }` and `tooSmall(size: Pick<Size, 'cols' | 'rows'>): boolean` from `terminal.ts`, where `Size` is `querySize`'s result type.
  - `tiny tab shows the bigger message`: `tooSmall({ cols: 39, rows: 30 }) === true`.
- [ ] **Step 2: Run `node --test viewer/test`.** Expected: FAIL.
- [ ] **Step 3: Implement `terminal.ts`, `text.ts` and `claude-room.ts`.** If `probeGraphics()` is false, print the exact Global Constraints message and exit 1.
- [ ] **Step 4: Run `node --test viewer/test`.** Expected: PASS. Then do a manual check in Ghostty: with this Claude session running the installed mod (Task 7 installs it; for now run `claude --plugin-dir mod` in another tab), `viewer/claude-room.ts` shows that session's room, the bubbles change as tools run, clicking a desk shows its details, and resizing refits the image.
- [ ] **Step 5:** Format, update `Project.md`, and commit with `feat(viewer): run the office full screen in ghostty`.

### Task 6: Go to session (spike, then wire Enter)

**Files:**
- Create: `viewer/focus.ts`
- Modify: `viewer/claude-room.ts` (Enter handler)
- Modify: `mod/hooks/register.ts` and `mod/types/index.d.ts` (only if the spike needs a field such as `tty` or `title`)

**Interfaces:**
- Produces: `focusSession(room: RoomFile): Promise<{ ok: true } | { ok: false; reason: string }>`

- [ ] **Step 1: Spike, time-boxed to about 30 minutes.** Find a reliable way to bring the Ghostty tab or window that runs a given pid to the front on macOS. Try these in order:
  1. Ghostty's own CLI or AppleScript support in the installed version (`ghostty +help`, `osascript -e 'tell application "Ghostty" to get windows'`).
  2. System Events, raising the window or tab whose title matches the one Claude sets for the session.
  3. The pid → `ps -o tty=` → a Ghostty surface.

  Record what worked or failed in `Project.md` → Key Decisions.
- [ ] **Step 2: If a route works,** add only the fields it needs to `RoomFile` and the mod, with a mod test asserting the new field. Then implement `focusSession` with that route. If no route works, `focusSession` returns `{ ok: false, reason: 'Ghostty cannot be told to switch tabs; the session is <name> in <cwd>' }`.
- [ ] **Step 3: Wire Enter on a selected desk.** It calls `focusSession`. On `{ ok: false }`, the reason shows as the first details line. Test `enter on a desk shows the fallback reason` uses an injected `focusSession` that fails, and asserts the details lines start with the reason.
- [ ] **Step 4: Run `node --test viewer/test && claude plugin test mod`.** Expected: PASS. Then check it manually across two Ghostty tabs.
- [ ] **Step 5:** Format, update `Project.md`, and commit with `feat(viewer): go to a desk's session on enter`.

### Task 7: Install

**Files:**
- Create: `install.sh` (supports `--uninstall`)
- Create: `README.md` (what it is, `./install.sh`, open a Ghostty tab, run `claude-room`, requirements)
- Modify: `Project.md` (Setup section)

- [ ] **Step 1: Write `install.sh`.**
  - It symlinks `mod` to `~/.claude/skills/agent-room` and `viewer/claude-room.ts` to `~/.local/bin/claude-room`, creating `~/.local/bin` and running `chmod +x`.
  - It refuses to overwrite a non-symlink at either path.
  - It warns if `~/.local/bin` is not on `PATH`.
  - It checks that `node -v` is at least 24.
  - `--uninstall` removes only symlinks that point into this repo.
- [ ] **Step 2: Verify.** Run `./install.sh && ls -l ~/.claude/skills/agent-room ~/.local/bin/claude-room`. Expected: both links point into `~/repos/agent-room`. Run `./install.sh` again and it reports nothing changed. Run `./install.sh --uninstall` and both links are gone, then run `./install.sh` once more.
- [ ] **Step 3: Check end to end.** Start a new Claude session, run `claude-room` in a Ghostty tab, and confirm the new session's room appears within 1 s and its file goes away when the session exits.
- [ ] **Step 4:** Commit with `feat: add install script and readme`.
