import type { MeetrecApi } from '../../electron/shared/ipc-contract'

export function useMeetrec(): MeetrecApi {
  if (!window.meetrec) {
    throw new Error('window.meetrec is missing. Preload did not run.')
  }
  return window.meetrec
}
