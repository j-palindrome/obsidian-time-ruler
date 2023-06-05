import { Component, Notice, request } from 'obsidian'
import TimeRulerPlugin from '../main'
import ical from 'ical'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { setters } from '../app/store'

const WEBCAL = 'webcal'

export default class CalendarAPI extends Component {
  calendars: TimeRulerPlugin['settings']['calendars']
  removeCalendar: (calendar: string) => void

  constructor(
    calendars: CalendarAPI['calendars'],
    removeCalendar: CalendarAPI['removeCalendar']
  ) {
    super()
    this.calendars = calendars
    this.load()
    this.removeCalendar = removeCalendar
  }

  async onload() {
    this.loadEvents()
  }

  async loadEvents() {
    const events = {}
    const now = new Date()
    let i = 0
    await Promise.all(
      this.calendars.map((calendar) =>
        request(calendar).then(
          (data) => {
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
                start: startString,
                end: endString,
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
          },
          (err) => {
            new Notice('Time Ruler: failed to load calendar from ' + calendar)
            this.removeCalendar(calendar)
          }
        )
      )
    )

    setters.set({ events })
  }
}
