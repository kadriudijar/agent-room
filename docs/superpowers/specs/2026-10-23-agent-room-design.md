# Agent Room — Design

## Intent

A fun, live way to watch every Claude Code session the developer has open, and every agent and subagent inside them, drawn as an 8-bit pixel office in a Ghostty tab or split. Nothing is missing from Claude's own agents list; this exists because watching little characters work is more enjoyable and readable at a glance. The reference look is "Habblaud" (a browser app): a top-down pixel office, one room per project, characters at desks with speech bubbles showing their current action, a header with counts and account usage, and an activity log.

## Goals

- **Full-screen room view** in its own terminal tab or split, run as a separate program (`claude-room`).
- **One room per open Claude session**, labelled with the session's name (the name `ListAgents` and the usage footer show: `profiles-36`, or what `/rename` gave it).
- **Every agent gets a desk**: the session's main agent, each subagent, and subagents of subagents, seated beside the agent that spawned them and marked as helpers.
- **Live screens / bubbles** per desk with the agent's current action: reading a file (📖 + file name), running a command (`$ command`), editing (✏️ + file name), fetching a URL, and a "!" when the session needs the developer (a permission prompt or a question waiting).
- **Animation**: running agents type, idle agents lean back or idle; needing-you is visually loud.
- **Good pixel art** drawn as real images through the kitty graphics protocol, which Ghostty supports.
- **Header** with counts (rooms, agents, working, subagents, needs you) and account usage: the 5-hour and weekly rate-limit percentages with reset countdowns, as the usage footer shows them.
- **Activity log** panel: a time-stamped feed of actions across all sessions (time, agent, session, action).
- **Selecting a desk** (mouse click or keyboard) shows that agent's details inside the program: its task description, type, status, and recent actions.
- **Go to session**: from a selected desk, one key (Enter) brings the Ghostty tab or window running that session to the front. *Feasibility is unverified.* See "Open risk" below.

## Non-goals

- No browser window, web server, or WebSocket.
- No jumping straight into a subagent's conversation inside the target session. That needs `$.ui.view`, which Claude allows only in answer to the person's own input in that session, not from outside. Go to session brings the session forward, and the developer picks the agent there.
- No drawing inside Claude's own left-arrow agents list. Mods cannot hook it, and a mod cannot take the unmodified left arrow.
- No multiple-account support (the reference shows "Conta C / Conta D"). Usage is the developer's one account.
- No search box, project task progress bars, zoom/pan, or rooms that aren't sessions (the reference's reception, kitchen, lounge). The builder may add cheap decoration such as plants, a corridor and a window, but no rooms without agents.
- No fallback renderer for terminals without image support. Ghostty is the target; on any other terminal the program says it needs a kitty-graphics terminal and exits.

## Anti-goals

- It must never slow down, block, or break a Claude session. The session side is display-only: every failure is swallowed, and nothing reaches the model.
- It must not look like a generic dashboard with a sprite pasted on. The pixel office *is* the interface.
- No licensed or downloaded art. Every sprite is drawn in code.

## Constraints

- **Art:** all sprites (floor tiles, walls, desks, monitors, chairs, plants, characters with sit/type/idle/needs-you frames) are defined in code as small pixel grids with a shared palette, scaled up by an integer factor. Nothing to license, and everything is safe to commit to this shared team repo.
- **Terminal:** Ghostty on macOS via the kitty graphics protocol (PNG frames, replaced in place). The program reads the terminal's cell and pixel size to fit the image to the tab.
- **Repo:** its own repository at `~/repos/agent-room` (not the shared `claude` config repo). The session side is a Claude Code mod in `mod/`, run in every session by an `install.sh` that symlinks it into `~/.claude/skills` (where Claude Code auto-loads a plugin folder) and `claude-room` into `~/.local/bin`. Mod tests run with `claude plugin test mod`. `Project.md` describes the project. Simplest implementation, no speculative abstraction, `/vertical-chain-formatter` on changed code.
- **Mod API facts (verified in the plugin-authoring types):**
  - `$.agent.list()` gives every subagent and teammate (`id`, `description`, `type`, `status`, `parentId`, `name`).
  - `tool.call` events carry `agentId` (absent on the main loop).
  - `$.session.usage()` and `session.measure` give context and rate limits (see `~/repos/claude/mods/usage-footer/hooks/register.ts`).
  - The session name comes from `~/.claude/sessions/<pid>.json`, matched by session id, as the usage footer reads it.
  - `turn.start`, `turn.complete`, `agent.spawn` and `tool.check` are hookable.

## How it works (decided)

Two parts, joined by files:

1. **Session side: the `agent-room` mod** (`mod/`). It runs in every session and keeps one status file for its session at `~/.claude/agent-room/<sessionId>.json`, written atomically (write a temp file, then rename). No two sessions ever write the same file. It holds:
   - the session's id, name, cwd and pid
   - the main agent's status and current action
   - each subagent's id, parent, description, type, status and current action
   - the latest usage figures
   - a needs-you flag
   - a short ring buffer of recent actions for the activity log, each with a timestamp, agent id and short label

   The mod rewrites the file on the events above. Tool-call bursts may be coalesced to a few writes a second. The file is removed on `session.end`.
2. **Viewer: `claude-room`.** A standalone Node program in this repo, run from a Ghostty tab or split. It reads every file in `~/.claude/agent-room/` a few times a second. It treats a file whose pid is no longer alive as gone, and deletes it. It lays out one room per session and renders frames to a PNG, which it sends with the kitty graphics protocol. Text that must stay crisp (header numbers, log lines, labels) may be drawn as terminal text around or over the image instead of as pixels: the builder's call. Mouse clicks (terminal mouse reporting) and arrow or number keys select a desk, and Enter goes to that desk's session. Esc closes the details view, and `q` quits.

## Open risk: go to session

It is unverified whether a program can bring a specific Ghostty tab or window to the front on macOS.

Candidate routes:
- Ghostty's own scripting or IPC, if the installed version has any.
- AppleScript or System Events picking the window or tab by title. Claude Code sets the terminal title per session, and the status file can record that title.
- Matching the session's `tty` (from its pid).

The builder spikes this first. If no reliable route exists, Enter falls back to a toast naming the session and its cwd, and the rest of the design stands. Report the outcome to the developer.

## Left to the builder

- Language details for the viewer. Node is the default, with built-in `zlib` for PNG encoding and no image dependencies.
- How `claude-room` is installed onto `PATH` (for example, a symlink from `setup.sh` into `~/.local/bin`).
- Exact sprite designs, palette, scale factor, frame rate, room layout algorithm, and how many desks fit per room before a room grows.
- How each tool maps to an action label and icon, beyond the four named above.
- Exactly which events signal "needs you" (a pending `tool.check` permission ask, a waiting `AskUserQuestion`, or classic `Notification`). It must cover permission prompts and questions waiting on the developer.
- Write throttling, ring buffer length, and the exact status-file schema.
- How the activity log and details view are laid out on screen.

## Settled after the builder check

- **Needs you clears** when the wait ends. A `tool.check` hook sees the permission decision when its `await next(e)` returns. A waiting `AskUserQuestion` clears when its tool call settles. As a backstop, any later `tool.call` or `turn.complete` from the same agent also clears it.
- **Current action** is set when a `tool.call` starts and stays until the agent's next call. Working and idle come from `turn.start`/`turn.complete` for the main agent, and from `$.agent.list()` status for subagents. The mod polls `$.agent.list()` about once a second while any agent is running, so a quiet session never shows a stale "running".
- **Stale files:** the status file records the pid and the process start time. The viewer deletes a file only when that pid is dead or now belongs to a process with a different start time.
- **Go to session spike** decides the fallback; it doesn't gate other work. The fields it needs, such as the title or tty, are added only if the spike finds a working route. The fallback message appears in the details panel.
- **Screen:** the image fills the tab except for text rows the viewer reserves for the header and log. Text never overlays the image. Click positions map to desks from the terminal's reported cell and pixel size. Target the current Ghostty release.
- **Scope:** only sessions on this machine running the mod appear. A session started before the mod was installed appears once it restarts.

## Decided by Claude, not the developer

These are my calls. Check them:

- The viewer is Node, matching the TypeScript mods.
- Status files live under `~/.claude/agent-room/`.
- With no Claude sessions open, the room shows an empty office with a "no sessions" sign, rather than exiting.
- Non-Ghostty terminals get an error message and the program exits, with no ASCII fallback.
- Go to session targets the session's tab or window. Picking the agent inside it stays manual.
