import $ from 'jquery'
import _, { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import moment from 'moment'
import {
  App,
  Component,
  MarkdownView,
  Notice,
  Platform,
  TFile,
  normalizePath,
} from 'obsidian'
import {
  DataArray,
  DataviewApi,
  Literal,
  PageMetadata,
  STask,
  getAPI,
} from 'obsidian-dataview'
import { AppState, getters, setters } from '../app/store'
import { sounds } from '../assets/assets'
import TimeRulerPlugin from '../main'
import { TaskPriorities, priorityNumberToKey } from '../types/enums'
import { pageToTask, taskToText, textToTask } from './parser'
import { parseHeadingFromPath } from './util'

let dv: DataviewApi

export default class ObsidianAPI extends Component {
  previousLoadTasks: any[]
  excludePaths?: RegExp
  dailyNotePath: RegExp
  private settings: TimeRulerPlugin['settings']
  app: App
  saveSettings: () => void

  constructor(
    settings: ObsidianAPI['settings'],
    saveSettings: ObsidianAPI['saveSettings']
  ) {
    super()
    dv = getAPI() as DataviewApi
    this.settings = settings
    this.saveSettings = saveSettings
  }

  getSetting = <T extends keyof TimeRulerPlugin['settings']>(setting: T) =>
    this.settings[setting] as TimeRulerPlugin['settings'][T]

  playComplete() {
    if (this.settings.muted) return
    sounds.pop.currentTime = 0
    sounds.pop.play()
  }

  private getExcludePaths() {
    const excludePaths = app.vault.getConfig('userIgnoreFilters') as
      | string[]
      | undefined
    if (!excludePaths) return

    this.excludePaths = new RegExp(
      excludePaths.map((x) => `^${_.escapeRegExp(x)}`).join('|')
    )
  }

  loadTasks() {
    if (!dv.index.initialized) {
      setTimeout(() => this.loadTasks(), 500)
      return
    }
    const dailyNotePath = getters.get('dailyNotePath')
    const dailyNoteFormat = getters.get('dailyNoteFormat')

    const now = DateTime.now()
    const taskTest = new RegExp(
      `[${escapeRegExp(this.settings.customStatus.statuses)}]`
    )
    let search: DataArray<STask>
    try {
      search = dv.pages(this.settings.search)['file'][
        'tasks'
      ] as DataArray<STask>
    } catch (e) {
      new Notice(
        'Invalid Dataview query: ' + this.settings.search + '. Please fix.'
      )
      throw e
    }

    const pageSearch = dv
      .pages()
      .where((page) => page.completed === false) as DataArray<
      Record<string, Literal> & { file: PageMetadata }
    >

    if (this.settings.filterFunction) {
      try {
        const filter = eval(this.settings.filterFunction)
        search = filter(search)
      } catch (err) {
        console.error(err)
        new Notice(
          'Time Ruler: Error in custom search filter function (check console); fix in settings.'
        )
        throw err
      }
    }
    if (this.settings.taskSearch) {
      search = search.filter((item) =>
        item.text.contains(this.settings.taskSearch)
      )
    }

    const newTasks = search
      .filter((task) => {
        return (
          !(!this.settings.showCompleted && task.completed) &&
          taskTest.test(task.status) === this.settings.customStatus.include &&
          !(this.excludePaths && this.excludePaths.test(task.path)) &&
          !(
            task.start &&
            DateTime.isDateTime(task.start) &&
            now.diff(task.start, 'millisecond').milliseconds < 0
          )
        )
      })
      .array()

    const newPages = pageSearch
      .filter((page) => {
        return (
          !(!this.settings.showCompleted && page.completed) &&
          !(this.excludePaths && this.excludePaths.test(page.file.path)) &&
          !(
            page.start &&
            DateTime.isDateTime(page.start) &&
            now.diff(page.start, 'millisecond').milliseconds < 0
          )
        )
      })
      .array()

    const newLoadTasks = newTasks.concat(newPages as any)
    if (_.isEqual(newLoadTasks, this.previousLoadTasks)) return
    this.previousLoadTasks = newLoadTasks

    const pages = newPages.flatMap((page) => pageToTask(page))

    const tasks = newTasks
      .flatMap((item) => textToTask(item, dailyNotePath, dailyNoteFormat))
      .concat(pages)

    const tasksDict = _.fromPairs(tasks.map((task) => [task.id, task]))

    for (let task of _.values(tasksDict)) {
      if (!task.children) continue
      for (let child of task.children) {
        if (!tasksDict[child]) continue
        tasksDict[child].parent = task.id
      }
    }

    const newHeadings = _.uniq(
      tasks.map(
        (task) =>
          parseHeadingFromPath(task.path, dailyNotePath, dailyNoteFormat).name
      )
    )
      .filter((heading) => !this.settings.fileOrder.includes(heading))
      .sort()

    const newHeadingOrder = [...this.settings.fileOrder]
    for (let heading of newHeadings) {
      const afterFile = newHeadingOrder.findIndex(
        (otherHeading) => otherHeading > heading
      )
      if (afterFile === -1) newHeadingOrder.push(heading)
      else newHeadingOrder.splice(afterFile, 0, heading)
    }
    this.settings.fileOrder = newHeadingOrder
    this.saveSettings()

    setters.set({ tasks: tasksDict, fileOrder: this.settings.fileOrder })
  }

  updateFileOrder(file: string, before: string) {
    const beforeIndex = this.settings.fileOrder.indexOf(before)

    if (beforeIndex === -1) throw new Error('file not in headings list')
    const newFileOrder = [...this.settings.fileOrder]
    _.pull(newFileOrder, file)
    newFileOrder.splice(beforeIndex, 0, file)
    this.settings.fileOrder = newFileOrder
    this.saveSettings()
    setters.set({ fileOrder: newFileOrder })
  }

  async createTask(
    path: string,
    heading: string | undefined,
    dropData: Partial<TaskProps>
  ) {
    if (!path.endsWith('.md')) path += '.md'

    let position = {
      start: { col: 0, line: 0, offset: 0 },
      end: { col: 0, line: 0, offset: 0 },
    }

    let file = app.vault.getAbstractFileByPath(path)
    if (!(file instanceof TFile)) {
      file = await app.vault.create(path, '')
    }
    if (!(file instanceof TFile)) {
      new Notice(`Time Ruler: failed to create file ${path}`)
      return
    }

    const text = await app.vault.read(file)
    const lines = text.split('\n')

    let targetLine: number

    if (heading) {
      targetLine =
        lines.findIndex((line) =>
          new RegExp(`#+ ${_.escapeRegExp(heading)}$`).test(line)
        ) + 1
      if (this.settings.addTaskToEnd) {
        targetLine = lines.findIndex(
          (line, i) => i > targetLine && /^#+ /.test(line)
        )
        // add to end (creates new empty line)
        if (targetLine === -1) targetLine = lines.length
        else {
          // find the end of the heading's non-whitespace text
          while (/^\s*$/.test(lines[targetLine - 1]) && targetLine > 1)
            targetLine--
        }
      }

      position.start.line = targetLine
      position.end.line = targetLine
    } else {
      let i = 0
      while (lines[i] !== undefined && lines[i] === '') {
        i++
      }
      if (this.settings.addTaskToEnd) {
        targetLine = lines.length
      } else if (
        lines[i] === '---' &&
        lines.find((line) => line === '---', i + 1)
      ) {
        targetLine = lines.indexOf('---', i + 1) + 1
      } else targetLine = 0

      position = {
        start: { col: 0, line: targetLine, offset: 0 },
        end: { col: 0, line: targetLine, offset: 0 },
      }
    }

    const defaultTask: TaskProps = {
      page: false,
      children: [],
      title: '',
      originalTitle: '',
      originalText: '',
      tags: [],
      priority: TaskPriorities.DEFAULT,
      id: '',
      type: 'task',
      path,
      heading,
      position,
      status: ' ',
      ...dropData,
    }

    await this.saveTask(defaultTask, true)
    openTask(defaultTask)
  }

  async saveTask(task: TaskProps, newTask?: boolean) {
    var abstractFile = app.vault.getAbstractFileByPath(task.path)
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      await app.vault.create(task.path, '')
      abstractFile = app.vault.getAbstractFileByPath(task.path)
    }

    if (abstractFile && abstractFile instanceof TFile) {
      if (task.page) {
        app.fileManager.processFrontMatter(abstractFile, (frontmatter) => {
          for (let property of ['due', 'scheduled', 'completion', 'reminder']) {
            frontmatter[property] = task[property]
          }
          if (task.length && task.length.hour + task.length.minute) {
            frontmatter['length'] = `${task.length.hour}h${task.length.minute}m`
          }
          if (task.completion) {
            frontmatter.completed = true
          } else frontmatter.completed = false
          if (task.priority !== TaskPriorities.DEFAULT) {
            frontmatter.priority = priorityNumberToKey[task.priority]
          }
        })
      } else {
        const fileText = await app.vault.read(abstractFile)
        const lines = fileText.split('\n')

        let thisLine = lines[task.position.start.line] ?? ''
        const newText =
          (thisLine.match(/^\s*/)?.[0] ?? '') +
          taskToText(task, this.settings.fieldFormat)
        if (newTask) {
          lines.splice(task.position.start.line, 0, newText)
        } else {
          lines[task.position.start.line] = newText
        }

        await app.vault.modify(abstractFile, lines.join('\n'))
      }
    }
  }

  async onload() {
    this.registerEvent(
      app.metadataCache.on(
        // @ts-ignore
        'dataview:metadata-change',
        () => {
          if (dv.index.initialized) {
            this.loadTasks()
          }
        }
      )
    )
  }

  reload() {
    this.getExcludePaths()
  }
}

export async function getDailyNoteInfo(): Promise<
  Pick<AppState, 'dailyNoteFormat' | 'dailyNotePath'> | undefined
> {
  try {
    let { folder, format } = (await app.vault.readConfigJson(
      'daily-notes'
    )) as Record<string, string>
    if (!folder) folder = '/'
    if (!folder.endsWith('/')) folder += '/'
    if (!format) format = 'YYYY-MM-DD'

    return {
      dailyNoteFormat: format,
      dailyNotePath: folder,
    }
  } catch (err) {
    console.error(err)
    return
  }
}

export async function openTask(task: TaskProps) {
  await app.workspace.openLinkText(task.path, '')

  const mdView = app.workspace.getActiveViewOfType(MarkdownView)
  if (!mdView) return

  var cmEditor = mdView.editor

  cmEditor.setSelection(
    {
      line: task.position.end.line,
      ch: task.position.end.col,
    },
    {
      line: task.position.end.line,
      ch: task.position.end.col,
    }
  )

  cmEditor.focus()

  /**
   * There's a glitch with Obsidian where it doesn't show this when opening a link from Time Ruler.
   */
  if (Platform.isMobile) app['mobileNavbar'].show()
}

export function openTaskInRuler(line: number, path: string) {
  const id = `${path.replace(/\.md$/, '')}::${line}`
  const gottenTask = getters.getTask(id)
  if (!gottenTask) {
    new Notice('Task not loaded in Time Ruler')
    return
  }

  setters.set({
    searchStatus: !gottenTask.scheduled ? 'all' : false,
    findingTask: id,
  })

  setTimeout(() => {
    const foundTask = $(`[data-id="${id}"]`)

    foundTask[0]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'center',
    })
    foundTask.addClass('!bg-accent')
    setTimeout(() => foundTask.removeClass('!bg-accent'), 1500)
    setTimeout(() => setters.set({ findingTask: null }))
  }, 250)
}
