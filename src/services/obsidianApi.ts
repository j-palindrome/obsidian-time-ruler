import $ from 'jquery'
import _, { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import { App, Component, MarkdownView, Notice, Platform, TFile } from 'obsidian'
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
import { TaskPriorities } from '../types/enums'
import {
  getProperty,
  pageToTask,
  taskToPage,
  taskToText,
  textToTask,
} from './parser'
import { parseFileFromPath, parseHeadingFromPath } from './util'

let dv: DataviewApi

export default class ObsidianAPI extends Component {
  loadedFiles: Record<string, TaskProps[]>
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

  getExcludePaths() {
    const excludePaths = app.vault.getConfig('userIgnoreFilters') as
      | string[]
      | undefined
    if (!excludePaths) return

    this.excludePaths = new RegExp(
      excludePaths.map((x) => `^${_.escapeRegExp(x)}`).join('|')
    )
  }

  searchTasks(
    path: string,
    dailyNoteInfo: DailyNoteInfo,
    completed = false,
    dateBounds: [string, string]
  ) {
    const now = DateTime.now()
    const customStatuses = new RegExp(
      `[${escapeRegExp(this.settings.customStatus.statuses)}]`
    )
    let taskSearch: DataArray<STask>
    let pageSearch: DataArray<Record<string, Literal> & { file: PageMetadata }>
    try {
      let basicSearch = dv.pages(
        `"${path.replace(/"/g, '\\"')}" and (${this.settings.search || '""'})`
      ) as DataArray<Record<string, Literal> & { file: PageMetadata }>

      const testDateBounds = (task: Record<string, Literal>) => {
        const taskDate = task.scheduled ?? task.due ?? task.completion
        // don't want to show unscheduled completed tasks (overloading system)
        if (!DateTime.isDateTime(taskDate))
          return !task.completion || this.settings.showCompleted
        const dateString = taskDate.toISO({
          suppressMilliseconds: true,
          suppressSeconds: true,
          includeOffset: false,
        })
        if (!dateString) return true

        return dateString >= dateBounds[0] && dateString <= dateBounds[1]
      }

      taskSearch = (basicSearch['file']['tasks'] as DataArray<STask>).where(
        (task) =>
          ((completed && task.completed) ||
            ((!completed || !this.settings.showCompleted) &&
              !task.completed)) &&
          customStatuses.test(task.status) ===
            this.settings.customStatus.include &&
          !(this.excludePaths && this.excludePaths.test(task.path)) &&
          !(
            task.start &&
            DateTime.isDateTime(task.start) &&
            now < task.start
          ) &&
          testDateBounds(task)
      )

      pageSearch = basicSearch.where((page) => {
        const pageCompleted = getProperty(page, 'completed')
        return (
          (pageCompleted === false ||
            pageCompleted === null ||
            ((completed || this.settings.showCompleted) &&
              pageCompleted === true)) &&
          !(this.excludePaths && this.excludePaths.test(page.file.path)) &&
          !(
            page.start &&
            DateTime.isDateTime(page.start) &&
            now < page.start
          ) &&
          testDateBounds(page)
        )
      })
    } catch (e) {
      new Notice(
        'Invalid Dataview query: ' + this.settings.search + '. Please fix.'
      )
      throw e
    }

    if (this.settings.filterFunction) {
      try {
        const filter = eval(this.settings.filterFunction)
        taskSearch = filter(taskSearch)
      } catch (err) {
        console.error(err)
        new Notice(
          'Time Ruler: Error in custom search filter function (check console); fix in settings.'
        )
        throw err
      }
    }

    if (this.settings.taskSearch) {
      taskSearch = taskSearch.filter((item) =>
        item.text.contains(this.settings.taskSearch)
      )
    }

    const processedTasks: TaskProps[] = pageSearch
      .map((page) => pageToTask(page, this.settings.fieldFormat))
      .concat(
        taskSearch.map((task) =>
          textToTask(task, dailyNoteInfo, this.settings.fieldFormat)
        )
      )
      .array()

    const tasksDict = _.fromPairs(processedTasks.map((task) => [task.id, task]))

    for (let task of processedTasks) {
      if (task.page) continue
      // assign children where required
      if (!task.children) continue
      for (let child of task.children) {
        if (!tasksDict[child]) continue
        tasksDict[child].parent = task.id
      }
    }

    for (let task of processedTasks) {
      if (!task.page) continue
      task.children = []
      for (let child of processedTasks.filter(
        (child) =>
          child.id !== task.id &&
          parseFileFromPath(task.path) === parseFileFromPath(child.path) &&
          !child.parent
      )) {
        child.parent = task.id
        task.children.push(child.id)
      }
    }

    return processedTasks
  }

  loadTasks(path: string) {
    if (!dv.index.initialized) {
      return
    }

    const dailyNoteInfo = {
      dailyNotePath: getters.get('dailyNotePath'),
      dailyNoteFormat: getters.get('dailyNoteFormat'),
    }

    const searchWithinWeeks = getters.get('searchWithinWeeks')
    const dateBounds: [string, string] = [
      DateTime.now().plus({ weeks: searchWithinWeeks[0] }).toISODate(),
      DateTime.now().plus({ weeks: searchWithinWeeks[1] }).toISODate(),
    ]
    const tasks = this.searchTasks(path, dailyNoteInfo, false, dateBounds)
    const completedTasks = this.searchTasks(
      path,
      dailyNoteInfo,
      true,
      dateBounds
    )
    this.updateTasks([...tasks, ...completedTasks], path, dailyNoteInfo)
  }

  updateTasks(
    processedTasks: TaskProps[],
    path: string,
    dailyNoteInfo: DailyNoteInfo
  ) {
    const updatedTasks = {
      ...getters.get('tasks'),
    }

    const newHeadings = _.uniq(
      processedTasks.map((task) =>
        parseFileFromPath(
          parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
        )
      )
    )
      .filter((heading) => !this.settings.fileOrder.includes(heading))
      .sort()

    if (newHeadings.length > 0) {
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
    }

    let updated = false

    const updatedIds = processedTasks.map((task) => task.id)
    const pathName = path.replace('.md', '')

    for (let id of Object.keys(updatedTasks).filter(
      (taskId) => taskId.startsWith(pathName) && !updatedIds.includes(taskId)
    )) {
      // clear out all deleted tasks
      updated = true
      delete updatedTasks[id]
    }

    for (let task of processedTasks) {
      // fill in new tasks
      if (!_.isEqual(task, updatedTasks[task.id])) {
        updated = true
        updatedTasks[task.id] = task
      }
    }

    if (!updated) return

    setters.set({ tasks: updatedTasks, fileOrder: this.settings.fileOrder })
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

  async createTask(path: string, dropData: Partial<TaskProps>) {
    let [fileName, heading] = path.split('#')
    if (!fileName.endsWith('.md')) fileName += '.md'

    let position = {
      start: { col: 0, line: 0, offset: 0 },
      end: { col: 0, line: 0, offset: 0 },
    }

    let file = app.vault.getAbstractFileByPath(fileName)
    if (!(file instanceof TFile)) {
      file = await app.vault.create(fileName, '')
    }
    if (!(file instanceof TFile)) {
      new Notice(`Time Ruler: failed to create file ${fileName}`)
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
      path: fileName,
      position,
      status: ' ',
      fieldFormat: this.settings.fieldFormat,
      completed: false,
      ...dropData,
    }

    await this.saveTask(defaultTask, true)
    openTask(defaultTask)
  }

  private async getFile(path: string) {
    var abstractFile = app.vault.getAbstractFileByPath(parseFileFromPath(path))
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      await app.vault.create(parseFileFromPath(path), '')
      abstractFile = app.vault.getAbstractFileByPath(parseFileFromPath(path))
    }

    if (abstractFile && abstractFile instanceof TFile) return abstractFile
    else return undefined
  }

  async deleteTask(id: string) {
    const task = getters.getTask(id)
    const file = await this.getFile(task.path)
    console.log(file)

    if (!file) return
    const fileText = await app.vault.read(file)
    const lines = fileText.split('\n')

    lines.splice(
      task.position.start.line,
      task.position.end.line + 1 - task.position.start.line
    )

    console.log(lines)

    await app.vault.modify(file, lines.join('\n'))
  }

  async saveTask(task: TaskProps, newTask?: boolean) {
    const file = await this.getFile(task.path)
    if (!file) return
    if (task.page) {
      app.fileManager.processFrontMatter(file, (frontmatter) => {
        taskToPage(task, frontmatter)
      })
    } else {
      const fileText = await app.vault.read(file)
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

      await app.vault.modify(file, lines.join('\n'))
    }
  }

  async onload() {
    this.registerEvent(
      app.metadataCache.on(
        // @ts-ignore
        'dataview:metadata-change',
        (...args) => {
          this.loadTasks(args[1].path)
        }
      )
    )
  }
}

export async function getDailyNoteInfo(): Promise<
  Pick<AppState, 'dailyNoteFormat' | 'dailyNotePath'> | undefined
> {
  try {
    let { folder, format } = (await app.vault
      .readConfigJson('daily-notes')
      .catch(() => {
        return { folder: undefined, format: undefined }
      })) as Record<string, string>
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
  await app.workspace.openLinkText(parseFileFromPath(task.path), '')

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
  if (Platform.isMobile) {
    app['mobileNavbar'].show()
  }
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
