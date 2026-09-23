import { describe, expect, it } from 'vitest'
import { parseMicrosoftCalendars } from './microsoft-calendars'

describe('microsoft calendars', () => {
  it('maps the default calendar and skips a blank id', () => {
    expect(
      parseMicrosoftCalendars({
        value: [
          { id: 'default', name: 'Calendar', isDefaultCalendar: true },
          { id: 'team', name: 'Team' },
          { id: '  ', name: 'Nope' }
        ]
      })
    ).toEqual([
      { id: 'default', summary: 'Calendar', primary: true },
      { id: 'team', summary: 'Team', primary: false }
    ])
  })
})
