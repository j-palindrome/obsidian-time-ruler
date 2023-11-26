import { DateTime } from 'luxon'
import { AppState, getters, setters } from '../app/store'
import moment from 'moment'
import _ from 'lodash'
import { getDailyNoteInfo } from './obsidianApi'

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

const NaNtoZero = (numberTest: number) =>
  isNaN(numberTest) ? 0 : typeof numberTest === 'number' ? numberTest : 0

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
              hour: hour + NaNtoZero(task.length.hour),
              minute: minute + NaNtoZero(task.length.minute),
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

export const getTodayNote = () => {
  const dailyPath = getters.get('dailyNotePath')
  const dailyFormat = getters.get('dailyNoteFormat')
  const dailyNote = dailyPath + moment().format(dailyFormat) + '.md'
  return dailyNote
}

export const parseFileFromPath = (path: string) =>
  path.includes('#') ? path.slice(0, path.indexOf('#')) : path

export const parsePathFromDate = (
  date: string,
  dailyNoteInfo: DailyNoteInfo
) => {
  const formattedDate = moment(date).format(dailyNoteInfo.dailyNoteFormat)
  return dailyNoteInfo.dailyNotePath + formattedDate + '.md'
}

export const parseDateFromPath = (
  path: string,
  dailyNoteInfo: DailyNoteInfo
) => {
  const date = moment(
    path.replace(dailyNoteInfo.dailyNotePath, '').replace('.md', ''),
    dailyNoteInfo.dailyNoteFormat,
    true
  )
  if (!date.isValid()) return false
  return date
}

export const parseHeadingFromPath = (
  path: string,
  isPage: boolean,
  dailyNoteInfo: DailyNoteInfo
): string => {
  let name = ''
  let fileName = parseFileFromPath(path)
  if (isPage) {
    // page headings are their containing folder
    const folder = fileName.includes('/')
      ? fileName.slice(0, fileName.lastIndexOf('/'))
      : fileName
    name = folder.includes('/')
      ? folder.slice(folder.lastIndexOf('/') + 1)
      : folder
  } else if (parseDateFromPath(fileName, dailyNoteInfo)) {
    name =
      'Daily' + (path.includes('#') ? path.slice(path.indexOf('#' + 1)) : '')
  } else name = path

  return name
}

export const parseHeadingTitle = (path: string) => {
  return path.includes('#')
    ? path.slice(path.lastIndexOf('#') + 1)
    : path
        .slice(path.includes('/') ? path.lastIndexOf('/') + 1 : 0)
        .replace('.md', '')
}

export const getTasksByHeading = (
  tasks: AppState['tasks'],
  dailyNoteInfo: DailyNoteInfo,
  fileOrder: string[]
): [string, TaskProps[]][] => {
  return _.sortBy(
    _.entries(
      _.groupBy(tasks, (task) =>
        parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
      )
    ),
    ([heading, _tasks]) => fileOrder.indexOf(heading)
  )
}

export const createInDaily = (
  task: Partial<TaskProps>,
  dailyNoteInfo: DailyNoteInfo
) => {
  const date = !task.scheduled
    ? (DateTime.now().toISODate() as string)
    : (DateTime.fromISO(task.scheduled).toISODate() as string)

  const path = parsePathFromDate(date, dailyNoteInfo)

  getters.getObsidianAPI().createTask(path, task)
  setters.set({ newTask: false })
}

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

export const removeNestedChildren = (id: string, taskList: TaskProps[]) => {
  const childrenToRemove: number[] = []

  const recurse = (id: string, taskList: TaskProps[]) => {
    for (let i = 0; i < taskList.length; i++) {
      if (taskList[i].parent === id && !childrenToRemove.includes(i)) {
        childrenToRemove.push(i)
        childrenToRemove.push(...recurse(taskList[i].id, taskList))
      }
    }
    return childrenToRemove
  }

  recurse(id, taskList)
  for (let child of childrenToRemove.sort().reverse()) {
    taskList.splice(child, 1)
  }
}

export const isCompleted = (task: TaskProps) => {
  return task.page ? false : task.completion ? true : false
}
