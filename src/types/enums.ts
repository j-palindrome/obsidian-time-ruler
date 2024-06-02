import _ from 'lodash'

export enum TaskActions {
  DELETE = 'DELETE',
}

export enum TaskPriorities {
  HIGHEST,
  HIGH,
  MEDIUM,
  DEFAULT,
  LOW,
  LOWEST,
}

export const priorityKeyToNumber = {
  lowest: TaskPriorities.LOWEST,
  low: TaskPriorities.LOW,
  medium: TaskPriorities.MEDIUM,
  high: TaskPriorities.HIGH,
  highest: TaskPriorities.HIGHEST,
  default: TaskPriorities.DEFAULT,
}

export const simplePriorityToNumber = {
  '...': TaskPriorities.LOWEST,
  '?': TaskPriorities.LOW,
  '-': TaskPriorities.DEFAULT,
  '!': TaskPriorities.MEDIUM,
  '!!': TaskPriorities.HIGH,
  '!!!': TaskPriorities.HIGHEST,
}

export const priorityNumberToSimplePriority = _.invert(simplePriorityToNumber)
export const priorityNumberToKey = _.invert(priorityKeyToNumber)

export const keyToTasksEmoji = {
  reminder: '⏰',
  scheduled: '⏳',
  due: '📅',
  start: '🛫',
  completion: '✅',
  created: '➕',
  repeat: '🔁',
  low: '🔽',
  medium: '🔼',
  high: '⏫',
  highest: '🔺',
  lowest: '⏬',
}

export const TasksEmojiToKey = _.invert(keyToTasksEmoji)

const dataViewKeys = [
  'annotated',
  'children',
  'header',
  'line',
  'lineCount',
  'link',
  'list',
  'outlinks',
  'parent',
  'path',
  'position',
  'real',
  'section',
  'status',
  'subtasks',
  'symbol',
  'tags',
  'task',
  'text',
]
const sTaskKeys = [
  'checked',
  'completed', // boolean
  'fullyCompleted',
  'created',
  'due',
  'completion',
  'start',
  'scheduled',
  'length',
  'priority',
]
const fullCalendarKeys = [
  'startTime',
  'endTime',
  'date',
  'completed', // date
  'type',
  'allDay',
  'title',
]
const tasksKeys = [
  'start',
  'completion',
  'scheduled',
  'priority',
  'due',
  'created',
  'repeat',
]

const timeRulerKeys = ['duration', 'query']

export const RESERVED_FIELDS = dataViewKeys.concat(
  sTaskKeys,
  fullCalendarKeys,
  tasksKeys,
  timeRulerKeys
)

export const isTaskProps = (data: DropData): data is Partial<TaskProps> =>
  !data.type || !['heading', 'delete'].includes(data.type)
