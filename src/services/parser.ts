import { DateTime, Duration } from 'luxon'
import { Literal, PageMetadata, STask } from 'obsidian-dataview'
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
import { isDateISO, parseDateFromPath } from './util'
import { getters } from '../app/store'
import { startTransition } from 'react'
import { create } from 'zustand'

const ISO_MATCH = '\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2})?'
const TASKS_EMOJI_SEARCH = new RegExp(
  `[${_.values(keyToTasksEmoji).join('')}] ?(${ISO_MATCH})?`,
  'gi'
)
const TASKS_REPEAT_SEARCH = new RegExp(
  `${keyToTasksEmoji.repeat} ?([a-zA-Z0-9 ]+)`,
  'i'
)

const SIMPLE_SCHEDULED_DATE = /^(\d{4}-\d{2}-\d{2}) /
const SIMPLE_SCHEDULED_TIME = /^(\d{1,2}(:\d{1,2})?( ?- ?\d{1,2}(:\d{1,2})?)?)/
const SIMPLE_PRIORITY = / (\?|\!{1,3})$/
const SIMPLE_DUE = / ?> ?(\d{4}-\d{2}-\d{2})/

const KANBAN_DATE = / ?@\{(\d{4}-\d{2}-\d{2})\}/
const KANBAN_TIME = / ?@@\{(\d{2}:\d{2})\}/

export function textToTask(
  item: any,
  dailyNotePath: string,
  dailyNoteFormat: string
): TaskProps {
  const INLINE_FIELD_SEARCH = /[\[\(][^\]\)]+:: [^\]\)]+[\]\)] */g
  const TAG_SEARCH = /#[\p{Letter}\/\d_-]+/gu
  const MD_LINK_SEARCH = /\[\[(.*?)\]\]/g
  const LINK_SEARCH = /\[(.*?)\]\(.*?\)/g
  const REMINDER_MATCH = new RegExp(
    ` ?${keyToTasksEmoji.reminder} ?(${ISO_MATCH}( \\d{2}:\\d{2})?)|\\(@(\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2})?)\\)|@\\{(\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2})?)\\}`
  )

  const BLOCK_REFERENCE = /\^{a-z0-9}+$/

  const titleLine: string = item.text.match(/(.*?)(\n|$)/)?.[1] ?? ''

  const originalTitle: string = titleLine
    .replace(BLOCK_REFERENCE, '')
    .replace(INLINE_FIELD_SEARCH, '')
    .replace(TASKS_REPEAT_SEARCH, '')
    .replace(TASKS_EMOJI_SEARCH, '')
    .replace(TAG_SEARCH, '')
    .replace(REMINDER_MATCH, '')
    .replace(KANBAN_DATE, '')
    .replace(KANBAN_TIME, '')
    // these have to be in order for simple scheduled to detect at beginning
    .replace(SIMPLE_SCHEDULED_DATE, '')
    .replace(SIMPLE_SCHEDULED_TIME, '')
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

  const parseScheduledAndLength = () => {
    let rawScheduled = item.scheduled as DateTime | undefined
    let rawLength = item.length as Duration | undefined
    let length: TaskProps['length']
    let scheduled: TaskProps['scheduled']
    if (rawLength) length = { hour: rawLength.hours, minute: rawLength.minutes }
    let isDate: boolean = true
    if (rawScheduled) {
      // has Dataview scheduled, check if it's an ISO
      const hasTime = /scheduled:: ?\d{4}-\d{2}-\d{2}T/.test(item.text)
      if (hasTime) isDate = false
    }

    // test for date
    if (!rawScheduled) {
      // test inline

      const inlineDate =
        new RegExp(`${keyToTasksEmoji.scheduled} ?(${ISO_MATCH})`)?.[1] ??
        titleLine.match(SIMPLE_SCHEDULED_DATE)?.[1]
      if (inlineDate) {
        rawScheduled = DateTime.fromISO(inlineDate)
        if (!isDateISO(inlineDate)) isDate = false
      }
    }

    if (!rawScheduled) {
      // test for kanban
      const kanbanDate = titleLine.match(KANBAN_DATE)?.[1]
      if (kanbanDate) {
        rawScheduled = DateTime.fromISO(kanbanDate)
        const kanbanTime = titleLine.match(KANBAN_TIME)?.[1]

        if (kanbanTime) {
          const [hours, minutes] = kanbanTime.split(':')

          rawScheduled = rawScheduled.set({
            hour: Number(hours),
            minute: Number(minutes),
          })
          isDate = false
        }
      }
    }

    if (!rawScheduled && !(typeof item.parent === 'number')) {
      // test note title
      let titleDate = item.date as string | undefined
      const parsedPathDate = parseDateFromPath(
        item.path,
        dailyNotePath,
        dailyNoteFormat
      )

      if (parsedPathDate)
        titleDate = parsedPathDate.toISOString(false).slice(0, 10)
      if (titleDate) rawScheduled = DateTime.fromISO(titleDate)
    }
    // test for time (and length)
    if (rawScheduled) {
      let hour: number | undefined,
        minute: number | undefined = 0
      let endHour: number | undefined,
        endMinute: number | undefined = 0
      if (item['startTime']) {
        const splitStartTime = item['startTime'].split(':')
        hour = parseInt(splitStartTime[0])
        minute = parseInt(splitStartTime[1])
        if (item['endTime']) {
          const splitEndTime = item['endTime'].split(':')
          endHour = parseInt(splitEndTime[0])
          if (splitEndTime[1]) endMinute = parseInt(splitEndTime[1])
        }
      } else {
        const titleWithoutDate = titleLine.replace(SIMPLE_SCHEDULED_DATE, '')
        const simpleScheduled = titleWithoutDate.match(
          SIMPLE_SCHEDULED_TIME
        )?.[1]
        if (simpleScheduled) {
          const fullTime = simpleScheduled.split(/ ?- ?/)
          const [hourString, minuteString] = fullTime[0].split(':')
          hour = parseInt(hourString)
          if (minuteString) minute = parseInt(minuteString)
          const endTime = fullTime[1]
          if (endTime) {
            const splitEndTime = endTime.split(':')
            endHour = parseInt(splitEndTime[0])
            if (splitEndTime[1]) endMinute = parseInt(splitEndTime[1])
          }
        }
      }

      if (
        hour !== undefined &&
        !isNaN(hour) &&
        minute !== undefined &&
        !isNaN(minute)
      ) {
        rawScheduled = rawScheduled.set({ hour, minute })
        isDate = false
        if (
          endHour !== undefined &&
          endMinute !== undefined &&
          !isNaN(endHour) &&
          !isNaN(endMinute)
        ) {
          let endTime = rawScheduled.set({ hour: endHour, minute: endMinute })
          if (endTime < rawScheduled) endTime = endTime.plus({ day: 1 })
          rawLength = endTime.diff(rawScheduled).shiftTo('hour', 'minute')
          length = { hour: rawLength.hours, minute: rawLength.minutes }
        }
      }
    }

    if (!DateTime.isDateTime(rawScheduled)) scheduled = undefined
    else {
      scheduled = (
        isDate
          ? rawScheduled.toISODate()
          : rawScheduled.toISO({
              includeOffset: false,
              suppressMilliseconds: true,
              suppressSeconds: true,
            })
      ) as string
    }
    return { scheduled, length }
  }

  const parseDateKey = (key: 'due' | 'created' | 'start' | 'completion') => {
    let date = item[key]
    if (item[key] instanceof DateTime) {
      date = item[key].toISODate() as string
    }
    if (!date) {
      // test tasks
      date = item.text.match(
        new RegExp(`${keyToTasksEmoji[key]} ?(${ISO_MATCH})`)
      )?.[1]
    }
    if (!date && key === 'due') {
      // test simple due
      date = titleLine.match(SIMPLE_DUE)?.[1]
    }
    if (!(typeof date === 'string')) return undefined
    return date
  }

  const parseReminder = () => {
    const tasksReminders = new RegExp(
      `${keyToTasksEmoji.reminder} ?(${ISO_MATCH}( \\d{2}:\\d{2})?)`
    )
    const nativeReminders = new RegExp(
      /\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/
    )
    const reminder =
      item.text.match(tasksReminders)?.[1] ??
      item.text.match(nativeReminders)?.[1] ??
      undefined

    if (reminder) title = title.replace(reminder, '')
    return reminder
  }

  const parsePriority = (): number => {
    let priority = item['priority']

    if (typeof priority === 'number') return priority
    else if (priority)
      return priorityKeyToNumber[priority] ?? TaskPriorities.DEFAULT
    else {
      // tasks priority
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

      // simple priority
      const priorityMatch = titleLine.match(SIMPLE_PRIORITY)?.[1]
      if (priorityMatch) return simplePriorityToNumber[priorityMatch]
    }

    return TaskPriorities.DEFAULT
  }

  const parseRepeat = () => {
    return item['repeat'] ?? titleLine.match(TASKS_REPEAT_SEARCH)?.[1]
  }

  const { length, scheduled } = item.completion
    ? { length: undefined, scheduled: undefined }
    : parseScheduledAndLength()
  const due = item.completion ? undefined : parseDateKey('due')
  const completion = parseDateKey('completion')
  const start = parseDateKey('start')
  const created = parseDateKey('created')
  const repeat = parseRepeat()
  const priority = parsePriority()
  const reminder = parseReminder()

  return {
    id: parseId(item),
    page: false,
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
    blockReference: titleLine.match(BLOCK_REFERENCE)?.[0],
  }
}

export function pageToTask(
  item: Record<string, Literal> & { file: PageMetadata }
): TaskProps {
  const testDateTime = (prop) =>
    DateTime.isDateTime(prop)
      ? ((!prop.minute && !prop.hour
          ? prop.toISODate()
          : prop.toISO({
              suppressMilliseconds: true,
              suppressSeconds: true,
              includeOffset: false,
            })) as string)
      : undefined
  const testDuration = (prop) =>
    Duration.isDuration(prop)
      ? { hour: prop.hours, minute: prop.minutes }
      : undefined

  return {
    id: item.file.path,
    originalText: item.file.name as any,
    path: item.file.path,
    priority:
      typeof item.priority === 'string'
        ? priorityKeyToNumber[item.priority] ?? TaskPriorities.DEFAULT
        : TaskPriorities.DEFAULT,
    children: [],
    page: true,
    type: 'task',
    status: ' ',
    reminder: testDateTime(item.reminder),
    due: testDateTime(item.due),
    scheduled: testDateTime(item.scheduled),
    length: testDuration(item.length),
    tags: [...item.file.tags],
    title: item.file.name as any,
    originalTitle: item.file.name as any,
    notes: '',
    repeat: typeof item.repeat === 'string' ? item.repeat : undefined,
    extraFields: undefined,
    position: {
      start: { line: 0, col: 0, offset: 0 },
      end: { line: 0, col: 0, offset: 0 },
    },
    completion: testDateTime(item.completion),
    start: testDateTime(item.start),
    created: testDateTime(item.created),
    blockReference: undefined,
  }
}

const detectFieldFormat = (
  text: string,
  defaultFormat: FieldFormat['main']
): FieldFormat => {
  const parseMain = (): FieldFormat['main'] => {
    if (
      SIMPLE_SCHEDULED_TIME.test(text) ||
      SIMPLE_SCHEDULED_DATE.test(text) ||
      SIMPLE_DUE.test(text)
    )
      return 'simple'
    for (let emoji of Object.keys(TasksEmojiToKey)) {
      if (text.contains(emoji)) return 'tasks'
    }
    if (KANBAN_DATE.test(text)) return 'kanban'
    if (/\[allDay:: |\[date:: |\[startTime:: |\[endTime:: /.test(text))
      return 'full-calendar'
    if (/\[scheduled:: |\[due:: /.test(text)) return 'dataview'
    return defaultFormat
  }

  const parseReminder = (): FieldFormat['reminder'] => {
    if (text.contains(keyToTasksEmoji.reminder)) return 'tasks'
    return 'native'
  }

  const parseScheduled = (): FieldFormat['scheduled'] => {
    if (KANBAN_DATE.test(text)) return 'kanban'
    return 'default'
  }

  return {
    main: parseMain(),
    reminder: parseReminder(),
    scheduled: parseScheduled(),
  }
}

export function taskToText(
  task: TaskProps,
  defaultFieldFormat: FieldFormat['main']
) {
  const dailyNotePath = getters.get('dailyNotePath')
  const dailyNoteFormat = getters.get('dailyNoteFormat')

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
      if (task.scheduled) {
        let date = parseDateFromPath(task.path, dailyNotePath, dailyNoteFormat)
        let scheduledDate = task.scheduled.slice(0, 10)
        const includeDate =
          !date || date.toISOString(false).slice(0, 10) !== scheduledDate
        let scheduledTime = task.scheduled.slice(11, 16).replace(/^0/, '')
        if (task.length && task.length.hour + task.length.minute > 0) {
          const end = DateTime.fromISO(task.scheduled).plus(task.length)
          scheduledTime += ` - ${end.toFormat('HH:mm').replace(/^0/, '')}`
        }
        const checkbox = draft.slice(0, 6)
        draft =
          checkbox +
          (includeDate ? scheduledDate + ' ' : '') +
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
    case 'kanban':
      if (task.scheduled) {
        if (isDateISO(task.scheduled)) draft += ` @{${task.scheduled}}`
        else {
          draft += ` @{${task.scheduled.slice(
            0,
            10
          )}} @@{${task.scheduled.slice(11, 16)}}`
        }
      }
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

  if (task.blockReference) draft += ' ' + task.blockReference

  return draft
}
