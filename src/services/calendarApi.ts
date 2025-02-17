import * as ical2json from 'ical2json'
import ical from 'ical'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { Component, Notice, request, ToggleComponent } from 'obsidian'
import { getters, setters } from '../app/store'
import TimeRulerPlugin from '../main'
import { toISO } from './util'
import moment from 'moment'

let reportedOffline = false
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
    const events: Record<string, EventProps> = {}
    let i = 0

    let offline = false

    const searchWithinWeeks = getters.get('searchWithinWeeks')
    const showingPastDates = getters.get('showingPastDates')
    const dateBounds: [DateTime, DateTime] = showingPastDates
      ? [
          DateTime.now().minus({ weeks: searchWithinWeeks[1] }),
          DateTime.now().plus({ days: 1 }),
        ]
      : [
          DateTime.now().minus({ days: 1 }),
          DateTime.now().plus({ weeks: searchWithinWeeks[1] }),
        ]

    const calendarLoads = this.settings.calendars.map(async (calendar) => {
      try {
        const data = await request(calendar)
        const icsEvents = ical.parseICS(data)

        const calendarName = data.match(/CALNAME:(.*)/)?.[1] ?? 'Default'
        for (let [id, event] of _.entries(icsEvents) as [string, any][]) {
          if (!event.start || !event.end || event.type !== 'VEVENT') continue

          if (event.rrule) {
            var dates: Date[] = event.rrule.between(
              dateBounds[0].toJSDate(),
              dateBounds[1].toJSDate()
            )
            if (event.recurrences != undefined) {
              for (var r in event.recurrences) {
                const dateTime = DateTime.fromJSDate(new Date(r))
                // Only add dates that weren't already in the range we added from the rrule so that
                // we don't double-add those events.
                if (dateTime < dateBounds[1] && dateTime >= dateBounds[0]) {
                  dates.push(new Date(r))
                }
              }
            }
            let duration =
              DateTime.fromJSDate(event.end).toMillis() -
              DateTime.fromJSDate(event.start).toMillis()

            for (let date of dates) {
              // Use just the date of the recurrence to look up overrides and exceptions (i.e. chop off time information)
              const dateLookupKey = date.toISOString().substring(0, 10)
              let start: DateTime, end: DateTime
              // For each date that we're checking, it's possible that there is a recurrence override for that one day.
              if (
                event.recurrences != undefined &&
                event.recurrences[dateLookupKey] != undefined
              ) {
                // We found an override, so for this recurrence, use a potentially different title, start date, and duration.
                const currentEvent = event.recurrences[dateLookupKey]
                start = DateTime.fromJSDate(currentEvent.start).setZone('local')
                let curDuration =
                  DateTime.fromJSDate(currentEvent.end).toMillis() -
                  start.toMillis()
                end = start.plus({ millisecond: curDuration }).setZone('local')
              } else if (
                // If there's no recurrence override, check for an exception date.  Exception dates represent exceptions to the rule.
                event.exdate != undefined &&
                event.exdate[dateLookupKey] != undefined
              ) {
                continue
              } else {
                start = DateTime.fromJSDate(date).setZone('local')
                end = start.plus({ milliseconds: duration })
              }

              const startString = event.start['dateOnly']
                ? (start.toISODate() as string)
                : toISO(start)
              const endString = event.start['dateOnly']
                ? (end.toISODate() as string)
                : toISO(end)

              const thisId = `${id}-${startString}`
              const props: EventProps = {
                id: thisId,
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
              events[thisId] = props
            }
          } else {
            let end = DateTime.fromJSDate(event.end).setZone('local')
            if (end < dateBounds[0]) continue

            let start = DateTime.fromJSDate(event.start).setZone('local')
            if (start > dateBounds[1]) continue

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
        }

        i++
      } catch (err) {
        console.error(err)

        offline = true
      }

      if (offline && !reportedOffline) {
        reportedOffline = true
        new Notice('Time Ruler: calendars offline.')
      }
    })

    await Promise.all(calendarLoads)

    setters.set({ events })
  }
}
