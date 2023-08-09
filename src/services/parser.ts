import { DateTime, Duration } from 'luxon'
import { STask } from 'obsidian-dataview'
import {
  RESERVED_FIELDS,
  TaskPriorities,
  TasksEmojiToKey,
  keyToTasksEmoji,
  priorityKeyToNumber,
  priorityNumberToKey,
  priorityNumberToSimplePriority,
  simplePriorityToNumber,
} from '../types/enums'
import _ from 'lodash'
import { isDateISO } from './util'

const ISO_MATCH = '\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2})?'
const TASKS_EMOJI_SEARCH = new RegExp(
  `[${_.values(keyToTasksEmoji).join('')}] ?(${ISO_MATCH})?`,
  'gi'
)
const TASKS_REPEAT_SEARCH = new RegExp(
  `${keyToTasksEmoji.repeat} ?([a-zA-Z0-9 ]+)`,
  'i'
)

export function textToTask(item: any): TaskProps {
  const INLINE_FIELD_SEARCH = /[\[\(][^\]\)]+:: [^\]\)]+[\]\)] */g
  const TAG_SEARCH = /#[\w-\/]+ */g
  const MD_LINK_SEARCH = /\[\[(.*?)\]\]/g
  const LINK_SEARCH = /\[(.*?)\]\(.*?\)/g
  const REMINDER_MATCH = new RegExp(
    ` ?${keyToTasksEmoji.reminder} ?(${ISO_MATCH}( \\d{2}:\\d{2})?)|\\(@(\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2})?)\\)|@\\{(\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2})?)\\}`
  )
  const SIMPLE_SCHEDULED = /^\d+:\d+( ?- ?\d+:\d+)?/
  const SIMPLE_PRIORITY = / (\?|\!{1,3})$/
  const SIMPLE_DUE = / > (\d{4}-d{2}-d{2})/

  const titleLine: string = item.text.match(/(.*?)(\n|$)/)?.[1] ?? ''
  const originalTitle: string = titleLine
    .replace(INLINE_FIELD_SEARCH, '')
    .replace(TASKS_REPEAT_SEARCH, '')
    .replace(TASKS_EMOJI_SEARCH, '')
    .replace(TAG_SEARCH, '')
    .replace(REMINDER_MATCH, '')
    .replace(SIMPLE_SCHEDULED, '')
    .replace(SIMPLE_DUE, '')
    .replace(SIMPLE_PRIORITY, '')
  let title: string = originalTitle
    .replace(MD_LINK_SEARCH, '$1')
    .replace(LINK_SEARCH, '$1')

  const notes = item.text.includes('\n')
    ? item.text.match(/\n((.|\n)*$)/)?.[1]
    : undefined

  const extraFields = _.mapValues(_.omit(item, RESERVED_FIELDS), (x) =>
    x.toString()
  )

  /**
   * ids are used for scrolling to a task. They show as the [data-id] property.
   * @see Task
   * @see openTaskInRuler
   */
  const parseId = (task: STask) => {
    return task.section.path.replace(/\.md$/, '') + '::' + task.line
  }

  const parseLength = (
    scheduled: string | undefined
  ): { hour: number; minute: number } | undefined => {
    const length: Duration | undefined = item['length']
    if (length && !isNaN(length.hours) && !isNaN(length.minutes)) {
      return { hour: length.hours, minute: length.minutes }
    } else if (item['endTime'] && scheduled) {
      const startTime = DateTime.fromISO(scheduled)
      let endTime = startTime.plus({})
      const [hour, minute] = item['endTime']
        .split(':')
        .map((x: string) => parseInt(x))

      if (!isNaN(hour) && !isNaN(minute)) {
        endTime = endTime.set({ hour, minute })
        const diff = endTime.diff(startTime).shiftTo('hour', 'minute')

        if (
          !isNaN(diff.hours) &&
          !isNaN(diff.minutes) &&
          diff.hours >= 0 &&
          diff.minutes >= 0
        )
          return { hour: diff.hours, minute: diff.minutes }
      }
    }
    return undefined
  }

  const parseScheduled = () => {
    let scheduled = item.scheduled as DateTime | undefined
    let isDate: boolean = false

    if (!scheduled) {
      let date = item.date as string | undefined
      const testDailyNoteTask = !date && item.parent === undefined
      if (testDailyNoteTask) {
        date = item.section.path
          .replace(/\.md$/, '')
          .match(new RegExp(`${ISO_MATCH}$`))?.[0]
      }
      if (!date) return
      scheduled = DateTime.fromISO(date)
      isDate = true
    }

    const lengthCheck = item.text.match(
      new RegExp(
        `\\[scheduled:: (.*?)\\s*\\]|${keyToTasksEmoji.scheduled} ?(${ISO_MATCH})`
      )
    )
    const foundDate = lengthCheck?.[1] ?? lengthCheck?.[2]
    if (foundDate?.length === 10) isDate = true

    if (item['startTime']) {
      const [hour, minute] = item['startTime']
        .split(':')
        .map((x: string) => parseInt(x))

      if (!isNaN(hour) && !isNaN(minute)) {
        scheduled = scheduled.set({ hour, minute })
        isDate = false
      }
    }
    if (!DateTime.isDateTime(scheduled)) {
      return undefined
    }

    return isDate
      ? (scheduled.toISODate() as string)
      : (scheduled.toISO({
          includeOffset: false,
          suppressMilliseconds: true,
          suppressSeconds: true,
        }) as string)
  }

  const parseDateKey = (key: 'due' | 'created' | 'start' | 'completion') => {
    let date = item[key]
      ? ((item[key] as DateTime).toISODate() as string)
      : undefined
    if (!date) {
      date = item.text.match(
        new RegExp(`${keyToTasksEmoji[key]} ?(${ISO_MATCH})`)
      )?.[1]
    }
    if (!date) return
    return date
  }

  const parseReminder = () => {
    const tasksReminders = new RegExp(
      `${keyToTasksEmoji.reminder} ?(${ISO_MATCH}( \\d{2}:\\d{2})?)`
    )
    const nativeReminders = new RegExp(
      /\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/
    )
    const kanbanReminders = /@\{(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\}/
    const reminder =
      item.text.match(tasksReminders)?.[1] ??
      item.text.match(nativeReminders)?.[1] ??
      item.text.match(kanbanReminders)?.[1] ??
      undefined

    if (reminder) title = title.replace(reminder, '')
    return reminder
  }

  const parsePriority = (): number => {
    let priority = item['priority']

    if (!priority) {
      for (let emoji of [
        keyToTasksEmoji.highest,
        keyToTasksEmoji.high,
        keyToTasksEmoji.medium,
        keyToTasksEmoji.low,
        keyToTasksEmoji.lowest,
      ]) {
        if (item.text.includes(emoji))
          return priorityKeyToNumber[TasksEmojiToKey[emoji]]
      }
      return TaskPriorities.DEFAULT
    } else if (typeof priority === 'number') return priority
    else return priorityKeyToNumber[priority] ?? TaskPriorities.DEFAULT
  }

  const parseRepeat = () => {
    return item['repeat'] ?? titleLine.match(TASKS_REPEAT_SEARCH)?.[1]
  }

  const parseSimple = () => {
    let simpleScheduled: string | undefined,
      simpleLength: TaskProps['length'] | undefined,
      simpleDue: TaskProps['due'] | undefined,
      simplePriority: TaskProps['priority'] | undefined
    const scheduled = titleLine.match(SIMPLE_SCHEDULED)?.[0]
    if (scheduled) {
      const [startTime, endTime] = scheduled.split(/ ?- ?/)
      const date = item.section.path
        .replace(/\.md$/, '')
        .match(new RegExp(`${ISO_MATCH}$`))?.[0]
      if (date && startTime) {
        simpleScheduled = date + 'T' + startTime
      }
      if (simpleScheduled && endTime) {
        const duration = DateTime.fromISO(date + 'T' + endTime)
          .diff(DateTime.fromISO(simpleScheduled))
          .shiftTo('hour', 'minute')
        simpleLength = { hour: duration.hours, minute: duration.minutes }
      }
    }
    const priorityMatch = titleLine.match(SIMPLE_PRIORITY)?.[1]
    simplePriority = priorityMatch
      ? simplePriorityToNumber[priorityMatch]
      : undefined
    simpleDue = titleLine.match(SIMPLE_DUE)?.[1]
    return { simpleScheduled, simpleLength, simplePriority, simpleDue }
  }

  const { simpleScheduled, simpleLength, simpleDue, simplePriority } =
    parseSimple()
  const scheduled = simpleScheduled ?? parseScheduled()
  const due = simpleDue ?? parseDateKey('due')
  const completion = parseDateKey('completion')
  const start = parseDateKey('start')
  const created = parseDateKey('created')
  const repeat = parseRepeat()
  const priority = simplePriority ?? parsePriority()
  const length = simpleLength ?? parseLength(scheduled)
  const reminder = parseReminder()

  return {
    id: parseId(item),
    children:
      item.children.flatMap((child) =>
        child.completion ? [] : parseId(child as STask)
      ) ?? [],
    type: 'task',
    status: item.status,
    reminder,
    due,
    scheduled,
    length,
    tags: item.tags,
    title,
    originalTitle,
    originalText: item.text,
    notes,
    repeat,
    extraFields: _.keys(extraFields).length > 0 ? extraFields : undefined,
    position: item.position,
    heading: item.section.subpath,
    path: item.path,
    priority,
    completion,
    start,
    created,
  }
}

const detectFieldFormat = (
  text: string,
  defaultFormat: FieldFormat['main']
): FieldFormat => {
  const parseMain = (): FieldFormat['main'] => {
    if (/^\d+:\d+( ?- ?\d+:\d+)? /.test(text)) return 'simple'
    for (let emoji of Object.keys(TasksEmojiToKey)) {
      if (text.contains(emoji)) return 'tasks'
    }
    if (/\[allDay:: |\[date:: |\[startTime:: |\[endTime:: /.test(text))
      return 'full-calendar'
    if (/\[scheduled:: |\[due:: /.test(text)) return 'dataview'
    return defaultFormat
  }

  const parseReminder = (): FieldFormat['reminder'] => {
    if (text.contains(keyToTasksEmoji.reminder)) return 'tasks'
    if (/@\{\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?\}/.test(text)) return 'kanban'
    return 'native'
  }

  return { main: parseMain(), reminder: parseReminder() }
}

export function taskToText(
  task: TaskProps,
  defaultFieldFormat: FieldFormat['main']
) {
  let draft = `- [${
    task.completion ? 'x' : task.status
  }] ${task.originalTitle.replace(/\s+$/, '')} ${
    task.tags.length > 0 ? task.tags.join(' ') + ' ' : ''
  }`

  if (task.extraFields) {
    _.sortBy(_.entries(task.extraFields), 0).forEach(([key, value]) => {
      draft += `[${key}:: ${value}]`
    })
  }

  const { main, reminder } = detectFieldFormat(
    task.originalText,
    defaultFieldFormat
  )

  const formatReminder = (): string => {
    if (!task.reminder) return ''
    switch (reminder) {
      case 'kanban':
        return ` @{${task.reminder}}`
      case 'native':
        return ` (@${task.reminder})`
      case 'tasks':
        return ` ${keyToTasksEmoji.reminder} ${task.reminder}`
    }
  }

  switch (main) {
    case 'simple':
      if (task.scheduled && !isDateISO(task.scheduled)) {
        let scheduledTime = task.scheduled.slice(11, 16)
        if (task.length) {
          const end = DateTime.fromISO(task.scheduled).plus(task.length)
          scheduledTime += ` - ${end.toFormat('HH:mm')}`
        }
        draft =
          draft.slice(0, 6) +
          scheduledTime +
          ' ' +
          draft.slice(6).replace(/^\s+/, '')
      }
      if (task.due) draft += `  > ${task.due}`
      if (task.priority && task.priority !== TaskPriorities.DEFAULT) {
        draft += ` ${priorityNumberToSimplePriority[task.priority]}`
      }
      if (task.repeat) draft += `  [repeat:: ${task.repeat}]`
      if (task.start) {
        draft += `  [start:: ${task.start}]`
      }
      if (task.created) {
        draft += `  [created:: ${task.created}]`
      }
      if (task.completion) {
        draft += `  [completion:: ${task.completion}]`
      }
      break
    case 'dataview':
      if (task.scheduled) draft += `  [scheduled:: ${task.scheduled}]`
      draft += formatReminder()
      if (task.due) draft += `  [due:: ${task.due}]`
      if (task.length && task.length.hour + task.length.minute > 0) {
        draft += `  [length:: ${
          task.length.hour ? `${task.length.hour}h` : ''
        }${task.length.minute ? `${task.length.minute}m` : ''}]`
      }
      if (task.repeat) draft += `  [repeat:: ${task.repeat}]`
      if (task.start) {
        draft += `  [start:: ${task.start}]`
      }
      if (task.created) {
        draft += `  [created:: ${task.created}]`
      }
      if (task.priority && task.priority !== TaskPriorities.DEFAULT) {
        draft += `  [priority:: ${priorityNumberToKey[task.priority]}]`
      }
      if (task.completion) {
        draft += `  [completion:: ${task.completion}]`
      }
      break
    case 'full-calendar':
      if (task.scheduled) {
        draft += `  [date:: ${task.scheduled.slice(0, 10)}]`
        if (!isDateISO(task.scheduled))
          draft += `  [startTime:: ${task.scheduled.slice(11)}]`
        else draft += '  [allDay:: true]'
      }
      draft += formatReminder()
      if (task.due) draft += `  [due:: ${task.due}]`
      if (
        task.length &&
        task.length.hour + task.length.minute > 0 &&
        task.scheduled
      ) {
        const endTime = DateTime.fromISO(task.scheduled).plus(task.length)
        draft += `  [endTime:: ${endTime.hour}:${endTime.minute}]`
      }
      if (task.repeat) draft += `  [repeat:: ${task.repeat}]`
      if (task.start) {
        draft += `  [start:: ${task.start}]`
      }
      if (task.created) {
        draft += `  [created:: ${task.created}]`
      }
      if (task.priority && task.priority !== TaskPriorities.DEFAULT) {
        draft += `  [priority:: ${priorityNumberToKey[task.priority]}]`
      }
      if (task.completion) {
        draft += `  [completion:: ${task.completion}]`
      }
      break
    case 'tasks':
      if (task.length && task.length.hour + task.length.minute > 0)
        draft += `  [length:: ${
          task.length.hour ? `${task.length.hour}h` : ''
        }${task.length.minute ? `${task.length.minute}m` : ''}]`
      if (task.scheduled && !isDateISO(task.scheduled)) {
        draft += `  [startTime:: ${task.scheduled.slice(11)}]`
      }
      draft += formatReminder()
      if (task.priority && task.priority !== TaskPriorities.DEFAULT)
        draft += ` ${keyToTasksEmoji[priorityNumberToKey[task.priority]]}`
      if (task.repeat) draft += ` ${keyToTasksEmoji.repeat} ${task.repeat}`
      if (task.start) draft += ` ${keyToTasksEmoji.start} ${task.start}`
      if (task.scheduled)
        draft += ` ${keyToTasksEmoji.scheduled} ${task.scheduled.slice(0, 10)}`
      if (task.due) draft += ` ${keyToTasksEmoji.due} ${task.due}`
      if (task.created) draft += ` ${keyToTasksEmoji.created} ${task.created}`
      if (task.completion)
        draft += ` ${keyToTasksEmoji.completion} ${task.completion}`
      break
  }

  return draft
}
