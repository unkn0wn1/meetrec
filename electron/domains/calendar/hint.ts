/** Short account/calendar label for a row, prompt, or tray tooltip. */
export function eventHint(event: {
  accountEmail?: string | null
  calendarLabel?: string | null
  calendarPrimary?: boolean
}): string | null {
  const email = event.accountEmail?.trim() || null
  const calendar = event.calendarLabel?.trim() || null
  if (email && calendar && event.calendarPrimary === false) return `${email} · ${calendar}`
  if (email) return email
  if (calendar && event.calendarPrimary === false) return calendar
  return null
}
