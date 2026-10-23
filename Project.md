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

## Integrations

- **Claude Code mod API:** `tool.call`, `tool.check`, `turn.start`/`turn.complete`, `session.start`/`session.measure`/`session.end`, `$.agent.list()` and `$.fs`. Tests run with `claude plugin test mod`.
- **Claude Code's sessions folder** (`~/.claude/sessions/<pid>.json`): an internal format, read for the session's pid, process start time and name.

## Key Decisions

- **One status file per session.** No two sessions write the same file, so nothing contends.
- **Plain writes, not temp file plus rename.** The mod API has no rename. The viewer keeps the last good parse of a file it catches half-written.
- **Agent Room lives in its own repo.** It is not part of the shared `claude` config repo.
