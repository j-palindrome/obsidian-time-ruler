import ical from 'ical'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { Component, Notice, request } from 'obsidian'
import { setters } from '../app/store'
import TimeRulerPlugin from '../main'
import { toISO } from './util'

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
    if (!window.navigator.onLine) {
      console.warn('Time Ruler: Calendars offline.')
      return
    }
    const events = {}
    const now = DateTime.now()
    let i = 0

    const calendarLoads = this.settings.calendars.map(async (calendar) => {
      try {
        const data = await request(calendar)
        const icsEvents = ical.parseICS(data)
        const calendarName = data.match(/CALNAME:(.*)/)?.[1] ?? 'Default'
        for (let [id, event] of _.entries(icsEvents) as [string, any][]) {
          if (!event.start || !event.end || event.type !== 'VEVENT') continue

          let end = DateTime.fromJSDate(event.end).setZone('local')
          if (end < now) continue

          let start = DateTime.fromJSDate(event.start).setZone('local')

          const startString = event.start['dateOnly']
            ? (start.toISODate() as string)
            : toISO(start)
          const endString = event.start['dateOnly']
            ? (end.toISODate() as string)
            : toISO(end)

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
        console.error(err)
      }
    })

    await Promise.all(calendarLoads)

    setters.set({ events })
  }
}
