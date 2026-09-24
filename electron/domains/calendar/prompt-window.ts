/**
 * Whether the calendar prompt window should be shown after a status publish.
 * Null leaves the window as it is. A mic-only calendar start asks to show
 * once even after the event prompt has been dismissed.
 */
export function promptWindowVisible(input: {
  promptKey: string | null
  nextKey: string | null
  revealMicOnly: boolean
}): boolean | null {
  if (input.nextKey === input.promptKey && !input.revealMicOnly) return null
  return input.nextKey != null || input.revealMicOnly
}
