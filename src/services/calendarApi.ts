import ical from 'ical'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { Component, Notice, request } from 'obsidian'
import { setters } from '../app/store'
import TimeRulerPlugin from '../main'

const WEBCAL = 'webcal'

export default class CalendarAPI extends Component {
  settings: TimeRulerPlugin['settings']
  removeCalendar: (calendar: string) => void

  constructor(
    settings: CalendarAPI['settings'],
    removeCalendar: CalendarAPI['removeCalendar']
  ) {
    super()
    this.settings = settings
    this.removeCalendar = removeCalendar
  }

  async loadEvents() {
    if (!navigator.onLine) return
    const events = {}
    const now = new Date()
    let i = 0
    await Promise.all(
      this.settings.calendars.map(async (calendar) => {
        try {
          const data = await request(calendar)
          const icsEvents = ical.parseICS(data)
          const calendarName = data.match(/CALNAME:(.*)/)?.[1] ?? 'Default'

          for (let [id, event] of _.entries(icsEvents)) {
            if (
              !event.start ||
              !event.end ||
              event.type !== 'VEVENT' ||
              event.end < now
            )
              continue

            const startString = (
              event.start['dateOnly']
                ? DateTime.fromJSDate(event.start).toISODate()
                : DateTime.fromJSDate(event.start).toISO({
                    suppressMilliseconds: true,
                    suppressSeconds: true,
                    includeOffset: false,
                  })
            ) as string
            const endString = (
              event.start['dateOnly']
                ? DateTime.fromJSDate(event.end).toISODate()
                : DateTime.fromJSDate(event.end).toISO({
                    suppressMilliseconds: true,
                    suppressSeconds: true,
                    includeOffset: false,
                  })
            ) as string

            const props: EventProps = {
              id,
              title: event.summary ?? '',
              startISO: startString,
              endISO: endString,
              type: 'event',
              calendarId: `${i}`,
              calendarName: calendarName,
              color: '',
              notes: event.description,
              location: event.location,
            }

            events[id] = props
          }

          i++
        } catch (err) {
          new Notice('Time Ruler: failed to load calendar from ' + calendar)
          this.removeCalendar(calendar)
        }
      })
    )

    setters.set({ events })
  }
}
