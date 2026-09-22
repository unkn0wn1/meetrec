import type { MeetrecApi } from '../electron/shared/ipc-contract'

declare global {
  interface Window {
    meetrec: MeetrecApi
  }
}

export {}
