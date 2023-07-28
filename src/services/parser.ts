import { DateTime, Duration } from 'luxon'
import { STask } from 'obsidian-dataview'
import {
  RESERVED_FIELDS,
  TaskPriorities,
  TasksEmojiToKey,
  keyToTasksEmoji,
  priorityKeyToNumber,
  priorityNumberToKey,
} from '../types/enums'
import _ from 'lodash'
import { isDateISO } from './util'

const ISO_MATCH = '\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2})?'
const TASKS_EMOJI_SEARCH = new RegExp(
  `[${_.values(keyToTasksEmoji).join('')}] ?(${ISO_MATCH})?`,
  'gi'
)

export function textToTask(item: any): TaskProps {
  const INLINE_FIELD_SEARCH = /[\[\(].+:: .+[\]\)] ?/g
  const TAG_SEARCH = /#[\w-\/]+/g
  const MD_LINK_SEARCH = /\[\[(.*?)\]\]/g
  const LINK_SEARCH = /\[(.*?)\]\(.*?\)/g
  let title = (item.text.match(/(.*?)(\n|$)/)?.[1] ?? '')
    .replace(MD_LINK_SEARCH, '$1')
    .replace(INLINE_FIELD_SEARCH, '')
    .replace(TAG_SEARCH, '')
    .replace(LINK_SEARCH, '$1')
    .replace(TASKS_EMOJI_SEARCH, '')
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

  const scheduled = parseScheduled()
  const due = parseDateKey('due')
  const completion = parseDateKey('completion')
  const start = parseDateKey('start')
  const created = parseDateKey('created')
  const priority = parsePriority()
  const length = parseLength(scheduled)

  return {
    id: parseId(item),
    children:
      item.children.flatMap((child) =>
        child.completion ? [] : parseId(child as STask)
      ) ?? [],
    type: 'task',
    due,
    scheduled,
    length,
    tags: item.tags,
    title,
    notes,
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

export function taskToText(task: TaskProps) {
  let draft = `- [${task.completion ? 'x' : ' '}] ${task.title.replace(
    /\s+$/,
    ''
  )} ${task.tags.length > 0 ? task.tags.join(' ') + ' ' : ''}`

  if (task.extraFields) {
    _.sortBy(_.entries(task.extraFields), 0).forEach(([key, value]) => {
      draft += `[${key}:: ${value}]`
    })
  }

  switch (this.settings.fieldFormat) {
    case 'dataview':
      if (task.scheduled) draft += `  [scheduled:: ${task.scheduled}]`
      if (task.due) draft += `  [due:: ${task.due}]`
      if (task.length && task.length.hour + task.length.minute > 0) {
        draft += `  [length:: ${
          task.length.hour ? `${task.length.hour}h` : ''
        }${task.length.minute ? `${task.length.minute}m` : ''}]`
      }
      break
    case 'full-calendar':
      if (task.scheduled) {
        draft += `  [date:: ${task.scheduled.slice(0, 10)}]`
        if (!isDateISO(task.scheduled))
          draft += `  [startTime:: ${task.scheduled.slice(11)}]`
        else draft += '  [allDay:: true]'
      }
      if (task.due) draft += `  [due:: ${task.due}]`
      if (
        task.length &&
        task.length.hour + task.length.minute > 0 &&
        task.scheduled
      ) {
        const endTime = DateTime.fromISO(task.scheduled).plus(task.length)
        draft += `  [endTime:: ${endTime.hour}:${endTime.minute}]`
      }
      break
    case 'tasks':
      if (task.length && task.length.hour + task.length.minute > 0)
        draft += `  [length:: ${
          task.length.hour ? `${task.length.hour}h` : ''
        }${task.length.minute ? `${task.length.minute}m` : ''}]`
      if (task.scheduled) {
        if (!isDateISO(task.scheduled))
          draft += `  [startTime:: ${task.scheduled.slice(11)}]`
        draft += ` ${keyToTasksEmoji.scheduled} ${task.scheduled.slice(0, 10)}`
      }
      if (task.due) draft += ` ${keyToTasksEmoji.due} ${task.due}`
      break
  }
  switch (this.settings.fieldFormat) {
    case 'dataview':
    case 'full-calendar':
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
      if (task.start) draft += ` ${keyToTasksEmoji.start} ${task.start}`
      if (task.created) draft += ` ${keyToTasksEmoji.created} ${task.created}`
      if (task.priority && task.priority !== TaskPriorities.DEFAULT)
        draft += ` ${keyToTasksEmoji[priorityNumberToKey[task.priority]]}`
      if (task.completion)
        draft += ` ${keyToTasksEmoji.completion} ${task.completion}`
  }

  return draft
}
