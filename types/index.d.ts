export type Status = 'idle' | 'think' | 'read' | 'edit' | 'run' | 'error'

// The lead is the chat itself; crew join in when a job gets big; helpers are real subagents.
export type Role = 'lead' | 'crew' | 'helper'

// One character in this chat's office.
export type Worker = {
  id: string
  name: string
  role: Role
  status: Status
  atDesk: boolean
  movedAt: number
  isWalking: boolean
}

// The whole building: named after the chat's folder.
export type Board = { folder: string; workers: Worker[] }

declare module 'claude-code' {
  interface PluginState {
    'pixel-office': { board: Shaped<Board> }
  }
}
