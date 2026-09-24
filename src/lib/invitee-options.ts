export interface InviteeAttendee {
  name: string
  email: string | null
}

export interface InviteeOption {
  key: string
  name: string
  email: string | null
  /** Name, plus the email in parentheses when another invitee shares that name. */
  label: string
}

/** One option per trimmed name and email. Blank names are dropped. */
export function uniqueInviteeOptions(attendees: readonly InviteeAttendee[]): InviteeOption[] {
  const unique: InviteeAttendee[] = []
  const seen = new Set<string>()
  for (const attendee of attendees) {
    const name = attendee.name.trim()
    if (!name) continue
    const email = attendee.email?.trim() ? attendee.email.trim() : null
    const key = inviteeKey(name, email)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ name, email })
  }

  const nameCounts = new Map<string, number>()
  for (const attendee of unique) {
    nameCounts.set(attendee.name, (nameCounts.get(attendee.name) ?? 0) + 1)
  }

  return unique.map((attendee) => {
    const shared = (nameCounts.get(attendee.name) ?? 0) > 1
    const label = shared && attendee.email ? `${attendee.name} (${attendee.email})` : attendee.name
    return {
      key: inviteeKey(attendee.name, attendee.email),
      name: attendee.name,
      email: attendee.email,
      label
    }
  })
}

/** Writes the invitee name into that speaker's draft. An unknown option leaves drafts alone. */
export function applyInviteePick(
  drafts: Record<string, string>,
  speakerId: string,
  option: InviteeOption | undefined
): Record<string, string> {
  if (!option) return drafts
  return { ...drafts, [speakerId]: option.name }
}

/**
 * Keeps the option the user picked when two invitees share a name.
 * Falls back to the first name match, or empty when the draft matches nobody.
 */
export function selectedInviteeKey(
  options: readonly InviteeOption[],
  draftName: string,
  pickedKey: string | undefined
): string {
  const picked = options.find((option) => option.key === pickedKey)
  if (picked && picked.name === draftName) return picked.key
  return options.find((option) => option.name === draftName)?.key ?? ''
}

function inviteeKey(name: string, email: string | null): string {
  return `${encodeURIComponent(name)}|${encodeURIComponent(email ?? '')}`
}
