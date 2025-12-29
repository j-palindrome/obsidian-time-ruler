import * as ical2json from 'ical2json'
import ical from 'ical'
import _ from 'lodash'
import { DateTime } from 'luxon'
import {
  Component,
  Notice,
  request,
  requestUrl,
  RequestUrlParam,
  RequestUrlResponsePromise,
  ToggleComponent,
} from 'obsidian'
import { getters, setters } from '../app/store'
import TimeRulerPlugin from '../main'
import { toISO } from './util'
import {
  GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from './keys.secret.json'

let reportedOffline = false
export default class CalendarAPI extends Component {
  settings: TimeRulerPlugin['settings']
  plugin: TimeRulerPlugin
  removeCalendar: (calendar: string) => void

  constructor(
    settings: CalendarAPI['settings'],
    plugin: TimeRulerPlugin,
    removeCalendar: CalendarAPI['removeCalendar']
  ) {
    super()
    this.settings = settings
    this.plugin = plugin
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
        const calendarId = decodeURIComponent(
          calendar.match(/ical\/([^\/]+)\//)?.[1]!
        )
        const icsEvents = ical.parseICS(data)

        const calendarName = data.match(/CALNAME:(.*)/)?.[1] ?? 'Default'
        for (let [_id, event] of _.entries(icsEvents) as [string, any][]) {
          const id = _id.replace(/-/g, '')

          if (!event.start || !event.end || event.type !== 'VEVENT') continue

          if (event.rrule) {
            var dates: Date[] = event.rrule.between(
              dateBounds[0].toJSDate(),
              dateBounds[1].toJSDate()
            )
            if (dates.length > 0) {
              // patch for events convering between daylight savings time and the current time
              const timeDifference =
                event.start.getTimezoneOffset() - dates[0].getTimezoneOffset()
              dates.forEach((x: Date) => {
                x.setTime(x.getTime() - timeDifference * 60 * 1000)
              })
            }

            if (event.recurrences != undefined) {
              for (var r in event.recurrences) {
                const dateTime = DateTime.fromJSDate(new Date(r)).setZone(
                  'local'
                )

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
                : toISO(start.setZone('local'))
              const endString = event.start['dateOnly']
                ? (end.toISODate() as string)
                : toISO(end.setZone('local'))

              const thisId = `${id}::${startString}`
              const props: EventProps = {
                id: thisId,
                title: event.summary ?? '',
                startISO: startString,
                endISO: endString,
                type: 'event',
                calendarId,
                calendarName: calendarName,
                color: '',
                notes: event.description,
                location: event.location,
                editable: false,
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
              calendarId: calendarId,
              calendarName: calendarName,
              color: '',
              notes: event.description,
              location: event.location,
              editable: false,
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

    for (let [email, google] of Object.entries(this.settings.google)) {
      if (!google.accessToken) continue

      const response = await this.request(
        {
          url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          method: 'GET',
        },
        email
      )

      const json = await response.json
      for (let calendar of json.items) {
        if (!google.calendarIds[calendar.id])
          google.calendarIds[calendar.id] = {
            show: false,
            calendar: { summary: calendar.summary },
          }
      }

      // Fetch all events for shown calendars within date bounds
      for (let [calendarId, calendarData] of Object.entries(
        google.calendarIds
      )) {
        if (!calendarData.show) continue

        try {
          let allEvents: any[] = []
          let pageToken: string | undefined = undefined

          // Paginate through all results
          do {
            const calendarEvents = await this.fetchEvents(
              calendarId,
              dateBounds[0].toISO()!,
              dateBounds[1].toISO()!,
              email,
              pageToken
            )

            // Add events to the events object
            if (calendarEvents.items) {
              allEvents = allEvents.concat(calendarEvents.items)
            }

            pageToken = calendarEvents.nextPageToken
          } while (pageToken)

          for (let event of allEvents) {
            // console.log('event', event)
            // if (event.status === 'cancelled') continue

            events[event.id] = {
              id: event.id,
              title: event.summary ?? '',
              startISO: event.start?.dateTime || event.start?.date || '',
              endISO: event.end?.dateTime || event.end?.date || '',
              type: 'event',
              calendarId: calendarId,
              calendarName: calendarData.calendar.summary,
              color: event.colorId || '',
              notes: event.description,
              location: event.location,
              editable: email,
            }
          }
        } catch (err) {
          console.error(
            `Error fetching events for calendar ${calendarId}:`,
            err
          )
        }
      }
    }

    await Promise.all(calendarLoads)
    console.log(events)

    setters.set({ events })
  }

  private async request(
    options: RequestUrlParam,
    email: string
  ): Promise<RequestUrlResponsePromise> {
    try {
      const request = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.plugin.settings.google[email]
            .accessToken!}`,
          'Content-Type': 'application/json',
        },
      }

      const response = await requestUrl(request)
      return response
    } catch (error) {
      // console.error(error)

      // Try to refresh token and retry
      await this.refreshAccessToken(email)

      const response = await requestUrl({
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.plugin.settings.google[email]
            .accessToken!}`,
          'Content-Type': 'application/json',
        },
      })
      return response
    }
  }

  async fetchEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    email: string,
    pageToken?: string
  ) {
    if (!this.plugin.settings.google[email].accessToken) {
      throw new Error('Google API token not configured in settings')
    }

    const params = new URLSearchParams({
      key: GOOGLE_API_KEY || '',
    })
    if (timeMin)
      params.append(
        'timeMin',
        DateTime.fromISO(timeMin).toISO()!.replace(/\.\d+/, '')
      )
    if (timeMax) {
      params.append(
        'timeMax',
        DateTime.fromISO(timeMax).toISO()!.replace(/\.\d+/, '')
      )
    }
    params.append('singleEvents', 'true')
    if (pageToken) {
      params.append('pageToken', pageToken)
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`
    console.log(url)

    const response = await this.request(
      {
        url,
        method: 'GET',
      },
      email
    )

    const json = await response.json

    return json
  }

  private async refreshAccessToken(email: string) {
    if (!this.plugin.settings.google[email].refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await request({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || '',
        client_secret: GOOGLE_CLIENT_SECRET || '',
        refresh_token: this.plugin.settings.google[email].refreshToken || '',
        grant_type: 'refresh_token',
      }).toString(),
    })

    const data = JSON.parse(response)
    this.plugin.settings.google[email].accessToken = data.access_token
    await this.plugin.saveSettings()
  }

  async modifyEvent(eventData: Partial<EventProps>) {
    if (!eventData.editable) return
    const email = eventData.editable as string
    if (!this.plugin.settings.google[email].accessToken) {
      throw new Error('Google API token not configured in settings')
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      eventData.calendarId!
    )}/events/${encodeURIComponent(
      eventData.id!.replace(/::.*$/, '')
    )}?key=${encodeURIComponent(GOOGLE_API_KEY || '')}`

    setters.patchEvents({
      [eventData.id!]: {
        ...eventData,
      },
    })
    await this.request(
      {
        url,
        method: 'PATCH',
        body: JSON.stringify({
          start: { dateTime: DateTime.fromISO(eventData.startISO!).toISO() },
          end: { dateTime: DateTime.fromISO(eventData.endISO!).toISO() },
        }),
      },
      email
    )
  }

  async deleteEvent(calendarId: string, eventId: string, email: string) {
    if (!this.plugin.settings.google[email].accessToken) {
      throw new Error('Google API token not configured in settings')
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}?key=${encodeURIComponent(
      GOOGLE_API_KEY || ''
    )}`

    await this.request(
      {
        url,
        method: 'DELETE',
      },
      email
    )
    setters.deleteEvent(eventId)
  }
}
