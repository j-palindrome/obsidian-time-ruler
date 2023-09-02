import { DateTime } from 'luxon'
import { AppState, getters } from '../app/store'
import moment from 'moment'
import _ from 'lodash'

export function roundMinutes(date: DateTime) {
  return date.set({
    minute: Math.floor(date.minute / 15) * 15,
    second: 0,
    millisecond: 0,
  })
}

export function insertTextAtCaret(text: string) {
  const sel = window.getSelection()
  if (!sel) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
}

export function deleteTextAtCaret(chars: number) {
  const sel = window.getSelection()
  if (!sel) return
  // @ts-ignore
  for (let i = 0; i < chars; i++) sel.modify('extend', 'backward', 'character')
  sel.deleteFromDocument()
}

export const isDateISO = (isoString: string) => isoString.length === 10

export const processLength = ([time, items]: BlockData) => {
  const events: EventProps[] = []
  const tasks: TaskProps[] = []

  for (let item of items) {
    if (item.type === 'event') events.push(item)
    else tasks.push(item)
  }
  const tasksWithLength = tasks.filter((task) => task.length) as (TaskProps & {
    length: NonNullable<TaskProps['length']>
  })[]
  const totalLength =
    events.length > 0
      ? (DateTime.fromISO(events[0].endISO)
          .diff(DateTime.fromISO(events[0].startISO))
          .shiftTo('hour', 'minute')
          .toObject() as { hour: number; minute: number })
      : tasksWithLength.reduce(
          ({ hour, minute }, task) => {
            return {
              hour: hour + task.length.hour,
              minute: minute + task.length.minute,
            }
          },
          { hour: 0, minute: 0 }
        )

  const endTime = DateTime.fromISO(time).plus(totalLength).toISO({
    includeOffset: false,
    suppressMilliseconds: true,
    suppressSeconds: true,
  }) as string

  return { events, tasks, endISO: endTime }
}

export const getDailyNotePath = () => {
  const dailyPath = getters.get('dailyNotePath')
  const dailyFormat = getters.get('dailyNoteFormat')
  const dailyNote = dailyPath + moment().format(dailyFormat) + '.md'
  return dailyNote
}

export const parseDateFromPath = (
  path: string,
  dailyPath?: string,
  dailyFormat?: string
) => {
  const gotDailyPath = dailyPath ?? getters.get('dailyNotePath')
  const gotDailyFormat = dailyFormat ?? getters.get('dailyNoteFormat')

  const date = moment(
    path.replace(gotDailyPath, '').replace('.md', ''),
    gotDailyFormat,
    true
  )
  if (!date.isValid()) return false
  return date
}

export const parseHeadingFromPath = (
  path: string
): { level: 'heading' | 'group'; name: string } => {
  const level = path.includes('#') ? 'heading' : 'group'
  const name = (
    level === 'heading'
      ? path.slice(path.lastIndexOf('#') + 1)
      : path.includes('/')
      ? path.slice(path.lastIndexOf('/') + 1)
      : path
  ).replace(/\.md/, '')
  return { level, name }
}

export const getTasksByHeading = (tasks: AppState['tasks']) =>
  _.mapValues(
    _.groupBy(
      _.filter(tasks, (task) => !task.parent),
      (task) =>
        task.path.replace('.md', '') + (task.heading ? '#' + task.heading : '')
    ),
    (tasks) => _.sortBy(tasks, 'id')
  )

export const convertSearchToRegExp = (search: string) =>
  new RegExp(
    search
      .split(' ')
      .map((word) => _.escapeRegExp(word))
      .join('.*'),
    'i'
  )

export const isLengthType = (type?: DragData['dragType']) =>
  (type && type === 'task-length') || type === 'time'
