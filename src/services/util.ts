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
import { useEffect, useState } from 'react'
import useStateRef from 'react-usestateref'
import invariant from 'tiny-invariant'
import { Platform } from 'obsidian'
import TimeRulerPlugin from 'src/main'
import { TaskComponentProps } from 'src/components/Task'
import { priorityKeyToNumber, simplePriorityToNumber } from 'src/types/enums'
import { BlockProps } from 'src/components/Block'

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
  let startDate = DateTime.fromISO(startISO)

  for (let event of events) {
    const length = DateTime.fromISO(event.endISO).diff(
      DateTime.fromISO(event.startISO)
    )
    startDate = startDate.plus(length)
  }
  for (let task of tasks) {
    if (!task.length) continue
    const length = Duration.fromDurationLike(task.length)
    startDate = startDate.plus(length)
  }

  return _.max([toISO(startDate), endISO]) as string
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

export const parseFileFromPath = (path: string) =>
  path.includes('#') ? path.slice(0, path.indexOf('#')) : path

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
    path.replace(dailyNoteInfo.folder, '').replace('.md', ''),
    dailyNoteInfo.format,
    true
  )
  if (!date.isValid()) return false
  return date
}

export const parseHeadingFromPath = (
  path: string,
  isPage: boolean,
  dailyNoteInfo: AppState['dailyNoteInfo']
): string => {
  let name = ''
  let fileName = parseFileFromPath(path)
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

export const parseHeadingTitle = (path: string) => {
  return path.includes('#')
    ? path.slice(path.lastIndexOf('#') + 1)
    : path
        .slice(path.includes('/') ? path.lastIndexOf('/') + 1 : 0)
        .replace('.md', '')
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
  task.scheduled || task.due || task.completion

export const useCollapsed = (tasks: TaskProps[]) => {
  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const allHeadings = _.uniq(
    tasks.map((task) =>
      parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
    )
  )
  const collapsed = useAppStore(
    (state) =>
      !allHeadings
        .map((heading) => state.collapsed[heading] ?? false)
        .includes(false)
  )

  return { collapsed, allHeadings }
}

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
  const [viewMode, viewModeRef] = useAppStoreRef((state) => state.viewMode)
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

export const scrollToSection = async (id: string) =>
  new Promise<void>((resolve) => {
    let count = 0
    const scroll = () => {
      count++
      if (count > 10) {
        reject(`section not found: #time-ruler-${id}`)
        return
      }
      const child = document.getElementById(`time-ruler-${id}`)
      if (!child) {
        setTimeout(() => scrollToSection(id), 250)
        return
      }
      child.scrollIntoView({
        block: 'start',
        inline: 'start',
        behavior: 'smooth',
      })
      setTimeout(() => resolve(), 500)
    }
    scroll()
  })

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
  if (fields) {
    fieldTests = fields.split(/ ?(AND|OR|&|\|) ?/).flatMap((test) => {
      const matches = test.match(/(.+?) ?(!=|<=|>=|=|<|>) ?(.+)/)
      if (!matches) return []
      let value = matches[3]
      let parsedValue: string | number | boolean = value
      if (matches[1] === 'priority') {
        if (simplePriorityToNumber[value] !== undefined)
          parsedValue = simplePriorityToNumber[value]
        else if (priorityKeyToNumber[value] !== undefined)
          parsedValue = priorityKeyToNumber[value]
      } else if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else parsedValue = value

      return {
        key: matches[1],
        comparison: matches[2] as Comparison,
        value: parsedValue,
      }
    })
  }

  if (!paths && !tags && !fieldTests.length) return []

  const testField = (test: FieldTest, task: TaskProps): boolean => {
    let value: string = task[test.key] ?? task.extraFields?.[test.key]
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

  return _.filter(_.values(tasks), (task) => {
    if (task.completed || task.id === id) return false
    if (paths && paths.map((path) => task.path.includes(path)).includes(false))
      return false
    if (tags && tags.map((tag) => task.tags.includes(tag)).includes(false))
      return false
    if (
      fieldTests &&
      fieldTests.map((field) => testField(field, task)).includes(false)
    )
      return false
    return true
  })
}
