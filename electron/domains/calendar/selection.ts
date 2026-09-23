export interface ListedCalendar {
  id: string
  summary: string
  primary: boolean
}

export function defaultListedCalendar(list: ListedCalendar[]): ListedCalendar | null {
  return list.find((item) => item.primary) ?? list[0] ?? null
}
