# Agent Room

Every Claude Code session you have open, drawn as a room in an 8-bit pixel office. Every agent and subagent sits at a desk, and its screen and speech bubble show what it's doing right now. The office runs full screen in a Ghostty tab.

- A header shows counts (rooms, agents, working, helpers, needs you) and your 5-hour and weekly usage.
- A red **!** blinks over any agent waiting on you.
- An activity log runs under the office.
- Click a desk, or use Tab or the arrows, to see its details. Press **Enter** to jump to that session's Ghostty tab.

## Install

```bash
./install.sh            # links the mod into ~/.claude/skills and claude-room into ~/.local/bin
./install.sh --uninstall
```

Then start (or restart) your Claude sessions, open a Ghostty tab and run:

```bash
claude-room
```

## Requirements

- Ghostty 1.3+ on macOS, which provides kitty graphics and the AppleScript used for "go to session".
- Node 24+.
- Claude Code with mod (function hooks) support.

## How it works

- `mod/` runs in every Claude session. It writes that session's agents, actions, usage and recent activity to `~/.claude/agent-room/<session>.json`.
- `viewer/claude-room.ts` reads those files five times a second and draws the office with sprites drawn in code. It sends each frame to Ghostty as a PNG.

## Development

```bash
claude plugin test mod                 # mod tests
node --test 'viewer/test/*.test.ts'    # viewer tests
node viewer/snapshot.ts viewer/test/fixtures/busy.json /tmp/office.png 640 400 2
```
