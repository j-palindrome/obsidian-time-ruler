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
import { DataArray, DataviewApi, STask, getAPI } from 'obsidian-dataview'
import { AppState, getters, setters } from '../app/store'
import { sounds } from '../assets/assets'
import TimeRulerPlugin from '../main'
import { TaskPriorities } from '../types/enums'
import { taskToText, textToTask } from './parser'

let dv: DataviewApi

export default class ObsidianAPI extends Component {
  previousLoadTasks: string
  excludePaths?: RegExp
  dailyNotePath: RegExp
  settings: TimeRulerPlugin['settings']
  app: App
  saveSettings: () => void

  constructor(
    settings: ObsidianAPI['settings'],
    saveSettings: ObsidianAPI['saveSettings']
  ) {
    super()
    dv = getAPI() as DataviewApi
    this.load()
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
      excludePaths.map((x) => `^${_.escapeRegExp(x)}`).join('|')
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

  loadTasks() {
    const now = DateTime.now()
    const taskTest = new RegExp(
      `[${escapeRegExp(this.settings.customStatus.statuses)}]`
    )
    let search: DataArray<STask>
    try {
      search = dv.pages(this.settings.search)['file'][
        'tasks'
      ] as DataArray<STask>
      if (this.settings.taskSearch) {
        search = search.filter((item) =>
          item.text.contains(this.settings.taskSearch)
        )
      }
    } catch (e) {
      new Notice(
        'Invalid Dataview query: ' + this.settings.search + '. Please fix.'
      )
      throw e
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

    const newTaskString = JSON.stringify(newTasks)
    if (newTaskString === this.previousLoadTasks) return
    this.previousLoadTasks = newTaskString
    const tasks = newTasks.flatMap((item) => textToTask(item))
    const tasksDict = _.fromPairs(tasks.map((task) => [task.id, task]))

    for (let task of _.values(tasksDict)) {
      if (!task.children) continue
      for (let child of task.children) {
        if (!tasksDict[child]) continue
        tasksDict[child].parent = task.id
      }
    }

    const filePaths = _.uniq(tasks.map((task) => task.path))
      .filter((path) => !this.settings.fileOrder.includes(path))
      .sort()

    const newFileOrder = [...this.settings.fileOrder]
    for (let file of filePaths) {
      const afterFile = newFileOrder.findIndex((otherFile) => otherFile > file)
      if (afterFile === -1) newFileOrder.push(file)
      else newFileOrder.splice(afterFile, 0, file)
    }
    this.settings.fileOrder = newFileOrder
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
    if (!(file instanceof TFile)) return
    const text = await app.vault.read(file)
    const lines = text.split('\n')

    if (heading) {
      const headingLine = lines.findIndex((line) =>
        new RegExp(`#+ ${_.escapeRegExp(heading)}$`).test(line)
      )
      if (headingLine) {
        position.start.line = headingLine + 1
        position.end.line = headingLine + 1
      }
    } else {
      let i = 0
      while (lines[i] !== undefined && lines[i] === '') {
        i++
      }
      if (lines[i] === '---' && lines.slice(i + 1).includes('---')) {
        const endOfMetadata = lines.indexOf('---', i + 1) + 1
        position = {
          start: { col: 0, line: endOfMetadata, offset: 0 },
          end: { col: 0, line: endOfMetadata, offset: 0 },
        }
      }
    }

    const defaultTask: TaskProps = {
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
      const fileText = await app.vault.read(abstractFile)
      const lines = fileText.split('\n')

      const newText =
        (lines[task.position.start.line].match(/^\s*/)?.[0] ?? '') +
        taskToText(task, this.settings.fieldFormat)
      if (newTask) {
        lines.splice(task.position.start.line, 0, newText)
      } else {
        lines[task.position.start.line] = newText
      }

      await app.vault.modify(abstractFile, lines.join('\n'))
    }
  }

  async onload() {
    this.registerEvent(
      app.metadataCache.on(
        // @ts-ignore
        'dataview:index-ready',
        () => {
          console.log('reloading')
          this.loadTasks()
        }
      )
    )
    this.registerEvent(
      app.metadataCache.on(
        // @ts-ignore
        'dataview:metadata-change',
        () => {
          if (dv.index.initialized) {
            console.log('reloading')
            this.loadTasks()
          } else console.log('not initialized')
        }
      )
    )

    await this.getExcludePaths()
    await this.getDailyPath()

    if (dv.index.initialized) {
      console.log('reloading')

      this.loadTasks()
    }
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
