// The status file each session writes to <config dir>/agent-room/<sessionId>.json, read by claude-room.
export type Icon = 'read' | 'edit' | 'bash' | 'web' | 'agent' | 'ask' | 'other'
// label: one line, at most 80 chars.
export type Action = { icon: Icon; label: string }
export type DeskAgent = {
  // null is the session's main agent.
  id: string | null
  // null when main spawned it (or it is main).
  parentId: string | null
  name: string
  type: string
  description: string
  status: 'running' | 'idle' | 'done'
  needsYou: boolean
  action: Action | null
}
export type LogEntry = { at: number; agentId: string | null; icon: Icon; label: string }
export type Usage = { kind: 'five_hour' | 'seven_day'; percent: number; resetsAt?: string }
export type RoomFile = {
  version: 1
  sessionId: string
  name: string
  cwd: string
  // From ~/.claude/sessions/<pid>.json matched by sessionId; 0 when no entry matched.
  pid: number
  procStart: string
  updatedAt: number
  // agents[0] is main.
  agents: DeskAgent[]
  usage: Usage[]
  // Newest last, at most 50.
  log: LogEntry[]
}
