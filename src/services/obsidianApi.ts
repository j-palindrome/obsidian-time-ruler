import $ from 'jquery'
import _ from 'lodash'
import { DateTime, Duration } from 'luxon'
import { Component, MarkdownView, Notice, TFile } from 'obsidian'
import { DataArray, DataviewApi, STask, getAPI } from 'obsidian-dataview'
import { getters, setters } from '../app/store'
import TimeRulerPlugin from '../main'
import invariant from 'tiny-invariant'
import {
  RESERVED_FIELDS,
  TaskPriorities,
  TasksEmojiToKey as TasksEmojiToKey,
  keyToTasksEmoji,
  priorityKeyToNumber,
  priorityNumberToKey
} from '../types/enums'
import { isDateISO } from './util'
import { sounds } from '../assets/assets'
import { Timer } from '../components/Timer'

const ISO_MATCH = '\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2})?'
const TASKS_EMOJI_SEARCH = new RegExp(
  `[${_.values(keyToTasksEmoji).join('')}] ?(${ISO_MATCH})?`,
  'gi'
)

let dv: DataviewApi

export default class ObsidianAPI extends Component {
  previousLoadTasks: string
  excludePaths?: RegExp
  dailyNotePath: RegExp
  settings: TimeRulerPlugin['settings']

  constructor(settings: ObsidianAPI['settings']) {
    super()
    dv = getAPI() as DataviewApi
    this.load()
    this.settings = settings
  }

  playComplete() {
    if (this.settings.muted) return
    sounds.pop.currentTime = 0
    sounds.pop.play()
  }

  /**
   * There isn't a way to get native Obsidian settings so we read them from disk. This will ignore tasks from any folders that the user has specified globally.
   */
  private async getExcludePaths() {
    const configFile = await app.vault.adapter.read(
      `${app.vault.configDir}/app.json`
    )
    if (!configFile) return
    const excludePaths: string[] | undefined =
      JSON.parse(configFile)?.['userIgnoreFilters']
    if (!excludePaths) return
    this.excludePaths = new RegExp(
      excludePaths.map(x => `^${_.escapeRegExp(x)}`).join('|')
    )
  }

  private async getDailyPath() {
    try {
      const configFile = await app.vault.adapter.read(
        `${app.vault.configDir}/daily-notes.json`
      )
      if (!configFile) return
      const dailyNotes: string | undefined = JSON.parse(configFile)?.['folder']
      if (!dailyNotes) return
      this.dailyNotePath = new RegExp(`^${_.escapeRegExp(dailyNotes)}`)
    } catch {}
  }

  textToTask(item: any): TaskProps {
    let title = item.text
      .replace(/[\[\(].+?:: .+?[\]\)] ?/g, '')
      .replace(/\W?#[\w-\/]+/g, '')
      .replace(TASKS_EMOJI_SEARCH, '')

    const extraFields = _.mapValues(_.omit(item, RESERVED_FIELDS), x =>
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

    const parseArea = (item: STask): string =>
      `${item.section.path.replace(/\.md$/, '').replace(/\//g, ': ')}`

    const parseLength = (
      scheduled: string | undefined
    ): { hour: number; minute: number } | undefined => {
      const length: Duration | undefined = item['length']
      if (length) {
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

          if (diff.hours >= 0 && diff.minutes >= 0)
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
        if (!date) {
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
            suppressSeconds: true
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
          keyToTasksEmoji.lowest
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
    const area = parseArea(item)

    return {
      id: parseId(item),
      children:
        item.children.flatMap(child =>
          child.completion ? [] : parseId(child as STask)
        ) ?? [],
      type: 'task',
      due,
      scheduled,
      length,
      tags: item.tags,
      title,
      extraFields: _.keys(extraFields).length > 0 ? extraFields : undefined,
      position: item.position,
      heading: item.section.subpath,
      path: item.path,
      area,
      priority,
      completion,
      start,
      created
    }
  }

  loadTasks() {
    const now = DateTime.now()
    const newTasks = (dv.pages()['file']['tasks'] as DataArray<STask>)
      .filter(task => {
        return (
          !task.completion &&
          !task.completed &&
          !(this.excludePaths && this.excludePaths.test(task.path)) &&
          !(
            task.start &&
            DateTime.isDateTime(task.start) &&
            now.diff(task.start, 'millisecond').milliseconds < 0
          )
        )
      })
      .array()

    const newTaskString = JSON.stringify(newTasks)
    if (newTaskString === this.previousLoadTasks) return
    this.previousLoadTasks = newTaskString
    const tasks = newTasks.flatMap(item => this.textToTask(item))
    const tasksDict = _.fromPairs(tasks.map(task => [task.id, task]))

    for (let task of _.values(tasksDict)) {
      if (!task.children) continue
      for (let child of task.children) {
        tasksDict[child].parent = task.id
      }
    }

    setters.set({ tasks: tasksDict })
  }

  async onload() {
    this.registerEvent(
      app.metadataCache.on(
        // @ts-ignore
        'dataview:metadata-change',
        (_type, _file, _oldPath) => {
          this.loadTasks()
        }
      )
    )
    await this.getExcludePaths()
    await this.getDailyPath()
    this.loadTasks()
  }

  generateStaticURL(src: string) {
    return app.vault.adapter.getResourcePath(
      app.vault.configDir +
        '/plugins/obsidian-time-ruler' +
        src.replace(/^\.\//, '/')
    )
  }

  private taskToText(task: TaskProps) {
    let draft = `- [${task.completion ? 'x' : ' '}] ${task.title.replace(
      /\s+$/,
      ''
    )}`
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
        if (task.scheduled) {
          draft += ` ${keyToTasksEmoji.scheduled} ${task.scheduled.slice(
            0,
            10
          )}`
          if (!isDateISO(task.scheduled))
            draft += ` [startTime:: ${task.scheduled.slice(11)}]`
        }
        if (task.due) draft += ` ${keyToTasksEmoji.due} ${task.due}`
        if (task.length && task.length.hour + task.length.minute > 0)
          draft += `  [length:: ${
            task.length.hour ? `${task.length.hour}h` : ''
          }${task.length.minute ? `${task.length.minute}m` : ''}]`
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

    if (task.extraFields) {
      _.sortBy(_.entries(task.extraFields), 0).forEach(([key, value]) => {
        draft += `  [${key}:: ${value}]`
      })
    }

    return draft
  }

  async createTask(
    path: string,
    heading: string | undefined,
    dropData: DropData
  ) {
    let position = {
      start: { col: 0, line: 0, offset: 0 },
      end: { col: 0, line: 0, offset: 0 }
    }

    if (heading) {
      const file = app.vault.getAbstractFileByPath(path) as TFile
      const text = await app.vault.read(file)
      const lines = text.split('\n')
      const headingLine = lines.findIndex(line =>
        new RegExp(`#+ ${_.escapeRegExp(heading)}$`).test(line)
      )
      if (headingLine) {
        position.start.line = headingLine + 1
        position.end.line = headingLine + 1
      }
    }

    const defaultTask: TaskProps = {
      children: [],
      title: '',
      tags: [],
      priority: TaskPriorities.DEFAULT,
      area: '',
      id: '',
      type: 'task',
      path,
      heading,
      position,
      ...dropData
    }

    await this.saveTask(defaultTask, true)
    openTask(defaultTask)
  }

  async saveTask(task: TaskProps, newLine?: boolean) {
    var abstractFilePath = app.vault.getAbstractFileByPath(task.path)

    const taskToText = this.taskToText.bind(this)
    if (abstractFilePath) {
      await new Promise(resolve =>
        app.vault
          .read(abstractFilePath as TFile)
          .then(async function (fileText) {
            const lines = fileText.split('\n')
            lines[task.position.start.line] =
              lines[task.position.start.line].slice(
                0,
                task.position.start.col
              ) +
              taskToText(task) +
              (newLine ? '\n' : '') +
              lines[task.position.start.line].slice(task.position.end.col)

            app.vault
              .modify(abstractFilePath as TFile, lines.join('\n'))
              .then(() => resolve(true))
          })
      )
    }
  }
}

export function openTaskInRuler(line: number, path: string) {
  const id = `${path.replace(/\.md$/, '')}::${line}`
  if (!getters.getTask(id)) {
    new Notice('Task not loaded in Time Ruler')
    return
  }
  setters.set({
    findingTask: id
  })

  const foundTask = $(`[data-id="${id}"]`)
  foundTask[0]?.scrollIntoView({
    behavior: 'smooth',
    inline: 'start',
    block: 'center'
  })
  foundTask.addClass('!bg-accent')
  setTimeout(() => foundTask.removeClass('!bg-accent'), 1000)
  setTimeout(() => setters.set({ findingTask: null }))
}

export function openTask(task: TaskProps) {
  app.workspace.openLinkText('', task.path).then(() => {
    const leaf = app.workspace.getLeaf()
    const view = leaf.getViewState()
    view.state.mode = 'source' // mode = source || preview
    leaf.setViewState(view)
    // @ts-ignore

    const mdView = leaf.view as MarkdownView
    var cmEditor = mdView.editor

    cmEditor.setSelection(
      {
        line: task.position.end.line,
        ch: task.position.end.col
      },
      {
        line: task.position.end.line,
        ch: task.position.end.col
      }
    )

    cmEditor.focus()
    /**
     * There's a glitch with Obsidian where it doesn't show this when opening a link from Time Ruler.
     */
    if (app['isMobile']) app['mobileNavbar'].show()
  })
}
