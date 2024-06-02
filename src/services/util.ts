import _, { reject } from 'lodash'
import { DateTime, Duration } from 'luxon'
import moment from 'moment'
import { Platform } from 'obsidian'
import { useEffect } from 'react'
import { BlockProps, UNGROUPED } from 'src/components/Block'
import {
  TaskPriorities,
  priorityKeyToNumber,
  priorityNumberToSimplePriority,
  simplePriorityToNumber,
} from 'src/types/enums'
import invariant from 'tiny-invariant'
import {
  AppState,
  getters,
  setters,
  useAppStore,
  useAppStoreRef,
} from '../app/store'

export function roundMinutes(date: DateTime) {
  return date.set({
    minute: Math.floor(date.minute) - (Math.floor(date.minute) % 15),
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
    if (!task.duration) continue
    const length = Duration.fromDurationLike(task.duration)
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
  if (path.includes('#')) path = path.slice(0, path.indexOf('#'))
  if (path.includes('>')) path = path.slice(0, path.indexOf('>'))
  if (path.includes('::')) path = path.slice(0, path.indexOf('::'))
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

export const splitHeading = (heading: string) => {
  return (
    heading.includes('>')
      ? heading.split('>', 2)
      : heading.includes('#')
      ? heading.split('#', 2)
      : heading.includes('/')
      ? heading.split('/', 2)
      : ['', heading]
  ) as [string, string]
}

export const getHeading = (
  { path, page, priority }: Pick<TaskProps, 'path' | 'page' | 'priority'>,
  dailyNoteInfo: AppState['dailyNoteInfo'],
  groupBy: AppState['settings']['groupBy'],
  hidePaths: string[] = []
): string => {
  path = path.replace('.md', '')
  let heading = path
  if (
    groupBy === 'priority' ||
    (groupBy === 'hybrid' && priority !== TaskPriorities.DEFAULT)
  )
    heading = priorityNumberToSimplePriority[priority]
  else if (groupBy === 'path' || groupBy === 'hybrid') {
    // replace daily note
    const file = parseFileFromPath(heading)
    const date = parseDateFromPath(file, dailyNoteInfo)
    if (date) heading = heading.replace(file, `Daily: ${date.format('MMM DD')}`)
    if (page) {
      heading = parseFolderFromPath(path)
    }
  } else heading = UNGROUPED

  if (hidePaths.includes(heading)) heading = UNGROUPED
  return heading
}

export const getTasksByHeading = (
  tasks: AppState['tasks'],
  dailyNoteInfo: AppState['dailyNoteInfo'],
  fileOrder: string[],
  groupBy: AppState['settings']['groupBy']
): [string, TaskProps[]][] => {
  return _.sortBy(
    _.entries(
      _.groupBy(
        _.filter(tasks, (task) => !task.completed),
        (task) => getHeading(task, dailyNoteInfo, groupBy)
      )
    ),
    ([heading, _tasks]) => fileOrder.indexOf(parseFileFromPath(heading))
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

export const useChildWidth = () => {
  const [_childWidth, childWidthRef] = useAppStoreRef(
    (state) => state.childWidth
  )
  const recreateWindow = useAppStore((state) => state.recreateWindow)
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

  // this needs to be refreshed upon moving the app to new window...
  useEffect(() => {
    console.log('environment just created again')
    function outputSize() {
      if (Platform.isMobile) {
        setChildWidth(1)
        return
      }
      const timeRuler = document.querySelector('#time-ruler')
      if (!timeRuler) {
        console.log('no time ruler')
        window.setTimeout(outputSize, 500)
        return
      }
      console.log('time ruler success')

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

    outputSize()
  }, [recreateWindow, viewMode])

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
    const child = document.getElementById(`time-ruler-${id}`)
    if (!child) {
      reject('child not found')
      return
    }

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
  return getStartDate(DateTime.now())
}

export const getStartDate = (time: DateTime) => {
  const dayEnd = getters.get('settings').dayStartEnd[1]
  if (dayEnd < 12 && time.hour < dayEnd)
    return time.minus({ days: 1 }).toISODate() as string
  else return time.toISODate() as string
}

export const hasPriority = (task: TaskProps) =>
  task.priority !== undefined && task.priority !== TaskPriorities.DEFAULT
