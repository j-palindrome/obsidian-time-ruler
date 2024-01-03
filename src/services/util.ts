import { DateTime, Duration } from 'luxon'
import {
  AppState,
  getters,
  setters,
  useAppStore,
  useAppStoreRef,
} from '../app/store'
import moment from 'moment'
import _, { reject } from 'lodash'
import ObsidianAPI, { getDailyNoteInfo } from './obsidianApi'
import NewTask from 'src/components/NewTask'
import { ScriptHTMLAttributes, useEffect, useRef, useState } from 'react'
import useStateRef from 'react-usestateref'
import invariant from 'tiny-invariant'
import { Platform } from 'obsidian'
import TimeRulerPlugin from 'src/main'
import { TaskComponentProps } from 'src/components/Task'
import {
  TaskPriorities,
  priorityKeyToNumber,
  priorityNumberToKey,
  priorityNumberToSimplePriority,
  simplePriorityToNumber,
} from 'src/types/enums'
import { BlockProps, UNGROUPED } from 'src/components/Block'
import { useRect } from '@dnd-kit/core/dist/hooks/utilities'

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

export const getEndISO = ({ tasks, events, startISO, endISO }: BlockProps) => {
  invariant(startISO, endISO)
  let startTime = DateTime.fromISO(startISO)

  for (let event of events) {
    const length = DateTime.fromISO(event.endISO).diff(
      DateTime.fromISO(event.startISO)
    )
    startTime = startTime.plus(length)
  }
  for (let task of tasks) {
    if (!task.length) continue
    const length = Duration.fromDurationLike(task.length)
    startTime = startTime.plus(length)
  }

  return _.max([toISO(startTime), endISO]) as string
}

export const getTodayNote = () => {
  const dailyNoteInfo = getters.get('dailyNoteInfo')
  const dailyNote =
    dailyNoteInfo.folder + moment().format(dailyNoteInfo.format) + '.md'
  return dailyNote
}

export const parseFolderFromPath = (path: string) => {
  if (path.endsWith('/')) path = path.slice(0, path.length - 1)
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

export const parseFileFromPath = (path: string) => {
  if (path.includes('>')) path = path.slice(0, path.indexOf('>'))
  if (path.includes('#')) path = path.slice(0, path.indexOf('#'))
  if (path.includes(':')) path = path.slice(0, path.indexOf(':'))
  return path
}

export const parsePathFromDate = (
  date: string,
  dailyNoteInfo: AppState['dailyNoteInfo']
) => {
  const formattedDate = moment(date).format(dailyNoteInfo.format)
  return dailyNoteInfo.folder + formattedDate + '.md'
}

export const parseDateFromPath = (
  path: string,
  dailyNoteInfo: AppState['dailyNoteInfo']
) => {
  const date = moment(
    parseFileFromPath(path.replace(dailyNoteInfo.folder, '')).replace(
      '.md',
      ''
    ),
    dailyNoteInfo.format,
    true
  )
  if (!date.isValid()) return false
  return date
}

export const parseHeadingFromTask = (
  task: TaskProps,
  tasks: AppState['tasks'],
  dailyNoteInfo: AppState['dailyNoteInfo'],
  hidePaths: string[] = [],
  parentId?: string
) => {
  let parent = task.parent ? tasks[task.parent] : undefined
  if (parent?.id === parentId) parent = undefined
  const heading =
    parseHeadingFromPath(task.path, task.page, dailyNoteInfo) +
    (parent ? '>' + parent.title : '')
  if (hidePaths.includes(heading)) return undefined
  return heading
}

export const parseHeadingFromPath = (
  path: string,
  isPage: boolean,
  dailyNoteInfo: AppState['dailyNoteInfo']
): string => {
  let name = ''
  let fileName = parseFileFromPath(path).replace('.md', '')
  if (isPage) {
    // page headings are their containing folder
    name = parseFolderFromPath(fileName)
  } else if (parseDateFromPath(fileName, dailyNoteInfo)) {
    name =
      'Daily' +
      (path.includes('#') ? '#' + path.slice(path.indexOf('#') + 1) : '')
  } else name = path

  return name
}

export const formatHeadingTitle = (
  path: string | number,
  groupBy: AppState['settings']['groupBy'],
  dailyNoteInfo: AppState['dailyNoteInfo'],
  page?: boolean
): [string, string] => {
  path = String(path)
  switch (groupBy) {
    case 'path':
      invariant(typeof path === 'string')
      const name = parseHeadingFromPath(path, page ?? false, dailyNoteInfo)
      return [
        path.includes('>')
          ? path.slice(path.lastIndexOf('>') + 1)
          : path.includes('#')
          ? path.slice(path.lastIndexOf('#') + 1)
          : path
              .slice(path.includes('/') ? path.lastIndexOf('/') + 1 : 0)
              .replace('.md', ''),
        name.includes('#')
          ? parseFileFromPath(name)
          : parseFolderFromPath(name),
      ]
    case 'priority':
      return [priorityNumberToSimplePriority[path], '']
    case 'hybrid':
      return priorityNumberToSimplePriority[path]
        ? [priorityNumberToSimplePriority[path], '']
        : formatHeadingTitle(path, 'path', dailyNoteInfo, page)
    case false:
      return ['', '']
  }
}

export const getTasksByHeading = (
  tasks: AppState['tasks'],
  dailyNoteInfo: AppState['dailyNoteInfo'],
  fileOrder: string[]
): [string, TaskProps[]][] => {
  return _.sortBy(
    _.entries(
      _.groupBy(
        _.filter(tasks, (task) => !task.completed),
        (task) => parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
      )
    ),
    ([heading, _tasks]) => fileOrder.indexOf(heading)
  )
}

export const convertSearchToRegExp = (search: string) =>
  new RegExp(
    search
      .split('')
      .map((letter) => _.escapeRegExp(letter))
      .join('.*?'),
    'i'
  )

export const isLengthType = (type?: DragData['dragType']) =>
  (type && type === 'task-length') || type === 'time'

export const removeNestedChildren = (id: string, taskList: TaskProps[]) => {
  for (let child of taskList) {
    if (child.parent === id) {
      _.remove(taskList, child)
    }
  }
}

export const parseTaskDate = (task: TaskProps): string | undefined =>
  task.scheduled || task.completion

export const toISO = (date: DateTime) =>
  date.toISO({
    suppressMilliseconds: true,
    suppressSeconds: true,
    includeOffset: false,
  }) as string

export const useHourDisplay = (hours: number) => {
  const twentyFourHourFormat = useAppStore(
    (state) => state.settings.twentyFourHourFormat
  )

  const hourDisplay = twentyFourHourFormat
    ? hours
    : [12, 0].includes(hours)
    ? '12'
    : hours % 12

  return hourDisplay
}

export const useChildWidth = ({
  container,
}: {
  container: React.RefObject<HTMLDivElement>
}) => {
  const [_childWidth, childWidthRef] = useAppStoreRef(
    (state) => state.childWidth
  )
  const setChildWidth = (newChildWidth: number) => {
    if (newChildWidth !== childWidthRef.current)
      setters.set({ childWidth: newChildWidth })
  }
  const [viewMode, viewModeRef] = useAppStoreRef(
    (state) => state.settings.viewMode
  )
  const childWidthToClass = [
    '',
    'child:w-full',
    'child:w-1/2',
    'child:w-1/3',
    'child:w-1/4',
  ]

  function outputSize() {
    if (Platform.isMobile) {
      setChildWidth(1)
      return
    }
    const timeRuler = container.current
    invariant(timeRuler)
    const width = timeRuler.clientWidth
    const newChildWidth =
      width < 500
        ? 1
        : width < 800
        ? 2
        : width < 1200 && viewModeRef.current !== 'week'
        ? 3
        : 4

    setChildWidth(newChildWidth)
  }

  useEffect(outputSize, [viewMode])

  useEffect(() => {
    outputSize()
    const timeRuler = document.querySelector('#time-ruler') as HTMLElement
    if (!timeRuler) return
    const observer = new ResizeObserver(outputSize)
    observer.observe(timeRuler)
    window.addEventListener('resize', outputSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', outputSize)
    }
  }, [])

  const appChildWidth = viewMode === 'hour' ? 1 : childWidthRef.current
  const appChildClass = childWidthToClass[appChildWidth]
  return {
    childWidth: appChildWidth,
    childClass: appChildClass,
  }
}

let scrolling = false
export const scrollToSection = async (id: string) => {
  let scrollTimeout: number | null = null
  return new Promise<void>((resolve) => {
    let count = 0
    const scroll = () => {
      count++
      if (count > 10) {
        reject(`section not found: #time-ruler-${id}`)
        return
      }
      const child = document.getElementById(`time-ruler-${id}`)
      if (!child) {
        if (scrollTimeout) {
          clearTimeout(scrollTimeout)
        }
        scrollTimeout = setTimeout(() => scrollToSection(id), 250)
        return
      }
      if (scrolling) return
      scrolling = true
      child.scrollIntoView({
        block: 'start',
        inline: 'start',
        behavior: 'smooth',
      })

      setTimeout(() => {
        resolve()
        scrollTimeout = null
        scrolling = false
      }, 500)
    }
    scroll()
  })
}

export const isGreater = (
  firstScheduled: string | undefined,
  lastScheduled: string | undefined
) => {
  if (!lastScheduled) return false
  else if (!firstScheduled && lastScheduled) return true
  else if (lastScheduled && firstScheduled) {
    return lastScheduled > firstScheduled
  }
}
export const queryTasks = (
  id: string,
  query: string,
  tasks: Record<string, TaskProps>
) => {
  const paths = query.match(/\"[^\"]+\"/g)?.map((x) => x.slice(1, -1))
  if (paths) {
    for (let path of paths) query = query.replace(`"${path}"`, '')
  }
  const tags = query.match(/#([\w-]+)/g)?.map((x) => x.slice(1))
  const fields = query.split(/ ?WHERE ?/)[1]

  type Comparison = '<' | '<=' | '=' | '>=' | '>' | '!='
  type FieldTest = {
    key: string
    comparison: Comparison
    value: string | number | boolean
  }
  let fieldTests: FieldTest[] = []
  const NOT_EXIST = 'NOT_EXIST'
  const EXIST = 'EXIST'
  if (fields) {
    fieldTests = fields.split(/ ?(AND|OR|&|\|) ?/).flatMap((test) => {
      const matches = test.match(/(.+?) ?(!=|<=|>=|=|<|>) ?(.+)/)
      let value = test.startsWith('!')
        ? NOT_EXIST
        : !matches
        ? EXIST
        : matches[3]
      let parsedValue: string | number | boolean = value
      let key = matches ? matches[1] : test
      if (matches && matches[1] === 'priority') {
        if (simplePriorityToNumber[value] !== undefined)
          parsedValue = simplePriorityToNumber[value]
        else if (priorityKeyToNumber[value] !== undefined)
          parsedValue = priorityKeyToNumber[value]
      } else if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else parsedValue = value

      return {
        key,
        comparison: (matches?.[2] ?? '=') as Comparison,
        value: parsedValue,
      }
    })
  }

  if (!paths && !tags && !fieldTests.length) return []

  const testField = (test: FieldTest, task: TaskProps): boolean => {
    let value: string = task[test.key] ?? task.extraFields?.[test.key]
    if (test.value === EXIST) return !!value
    if (test.value === NOT_EXIST) return !value
    if (value === undefined) return false

    switch (test.comparison) {
      case '=':
        return test.value === value
      case '!=':
        return test.value !== value
      case '<':
        return test.value < value
      case '<=':
        return test.value <= value
      case '>':
        return test.value > value
      case '>=':
        return test.value >= value
    }
  }

  return _.filter(_.values(tasks), (subtask) => {
    const thisScheduled = getParentScheduled(tasks[id], tasks)
    const scheduled = getParentScheduled(subtask, tasks)
    if (
      subtask.completed ||
      subtask.id === id ||
      !nestedScheduled(thisScheduled, scheduled)
    )
      return false
    if (
      paths &&
      paths.map((path) => subtask.path.includes(path)).includes(false)
    )
      return false

    if (tags && tags.map((tag) => subtask.tags.includes(tag)).includes(false))
      return false
    if (
      fieldTests &&
      fieldTests.map((field) => testField(field, subtask)).includes(false)
    )
      return false
    return true
  })
}

export const getChildren = (
  task: TaskProps,
  tasks: AppState['tasks']
): string[] =>
  !task
    ? []
    : task.children
        .flatMap((id) => [id, ...getChildren(tasks[id], tasks)])
        .concat(task.queryChildren ? task.queryChildren : [])

export const getParents = (task: TaskProps, tasks: AppState['tasks']) => {
  const parents: TaskProps[] = []
  let parent = task.parent ? tasks[task.parent] : undefined
  while (parent) {
    parents.push(parent)
    parent = parent.parent ? tasks[parent.parent] : undefined
  }
  return parents
}

export const getParentScheduled = (
  task: TaskProps,
  tasks: AppState['tasks']
) => {
  if (parseTaskDate(task)) return parseTaskDate(task)
  let parent = task.parent ?? task.queryParent
  while (parent) {
    task = tasks[parent]
    if (parseTaskDate(task)) return parseTaskDate(task)
    parent = task.parent ?? task.queryParent
  }
  return undefined
}

export const nestedScheduled = (
  parentScheduled: TaskProps['scheduled'],
  childScheduled: TaskProps['scheduled']
) => {
  const now = getToday()
  if (parentScheduled && parentScheduled < now) parentScheduled = now
  if (childScheduled && childScheduled < now) childScheduled = now
  return !parentScheduled && childScheduled
    ? false
    : parentScheduled && childScheduled && parentScheduled < childScheduled
    ? false
    : true
}

export const getToday = () => {
  const dayEnd = getters.get('settings').dayStartEnd[1]
  const now = DateTime.now()
  if (dayEnd < 12 && now.hour < dayEnd)
    return now.minus({ days: 1 }).toISODate()
  else return now.toISODate()
}

export const hasPriority = (task: TaskProps) =>
  task.priority !== undefined && task.priority !== TaskPriorities.DEFAULT
