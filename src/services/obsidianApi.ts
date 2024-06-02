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
import {
  getHeading,
  getParentScheduled,
  getParents,
  parseDateFromPath,
  parseFileFromPath,
  parsePathFromDate,
  parseTaskDate,
  queryTasks,
  scrollToSection,
  toISO,
} from './util'
import invariant from 'tiny-invariant'
import { splitHeading } from './util'

let dv: DataviewApi

export default class ObsidianAPI extends Component {
  loadedFiles: Record<string, TaskProps[]>
  excludePaths?: RegExp
  dailyNotePath: RegExp
  private settings: TimeRulerPlugin['settings']
  app: App
  setSetting: (settings: Partial<TimeRulerPlugin['settings']>) => void

  constructor(
    settings: ObsidianAPI['settings'],
    setSetting: ObsidianAPI['setSetting'],
    app: App
  ) {
    super()
    dv = getAPI() as DataviewApi
    this.settings = settings
    this.setSetting = setSetting
    this.app = app
  }

  getSetting = <T extends keyof TimeRulerPlugin['settings']>(setting: T) =>
    this.settings[setting] as TimeRulerPlugin['settings'][T]

  playComplete() {
    if (this.settings.muted) return
    sounds.pop.currentTime = 0
    sounds.pop.play()
  }

  reload() {
    const excludePaths = this.app.vault.getConfig('userIgnoreFilters') as
      | string[]
      | undefined
    if (!excludePaths) return

    this.excludePaths = new RegExp(
      excludePaths.map((x) => `^${_.escapeRegExp(x)}`).join('|')
    )
  }

  searchTasks(
    path: string,
    dailyNoteInfo: AppState['dailyNoteInfo'],
    completed = false,
    dateBounds: [string, string]
  ) {
    const now = DateTime.now()
    const customStatuses = new RegExp(
      `[${escapeRegExp(this.settings.customStatus.statuses)}]`
    )
    let taskSearch: DataArray<STask>
    let pageSearch: DataArray<Record<string, Literal> & { file: PageMetadata }>

    const testDateBounds = (task: Record<string, Literal>) => {
      const taskDate = task.scheduled ?? task.completion
      if (!DateTime.isDateTime(taskDate)) return true
      const dateString = toISO(taskDate)
      // Incomplete looks at preceding tasks, complete looks at following tasks
      return completed
        ? dateString >= dateBounds[0]
        : dateString <= dateBounds[1]
    }

    try {
      let basicSearch = dv.pages(
        `"${path.replace(/"/g, '\\"')}" and (${this.settings.search || '""'})`
      ) as DataArray<Record<string, Literal> & { file: PageMetadata }>

      taskSearch = (basicSearch['file']['tasks'] as DataArray<STask>).where(
        (task) => {
          const tested =
            (this.settings.showCompleted ||
              (completed && task.completed) ||
              (!completed && !task.completed)) &&
            customStatuses.test(task.status) ===
              this.settings.customStatus.include &&
            !(this.excludePaths && this.excludePaths.test(task.path)) &&
            !(
              task.start &&
              DateTime.isDateTime(task.start) &&
              now < task.start
            ) &&
            testDateBounds(task)

          return tested
        }
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

  loadTasks(path: string, completed: boolean) {
    if (!dv.index.initialized) {
      return
    }

    const dailyNoteInfo = getters.get('dailyNoteInfo')
    const searchWithinWeeks = getters.get('searchWithinWeeks')

    const showingPastDates = getters.get('showingPastDates')
    const dateBounds: [string, string] = showingPastDates
      ? [
          DateTime.now().minus({ weeks: searchWithinWeeks[1] }).toISODate(),
          DateTime.now().plus({ days: 1 }).toISODate(),
        ]
      : [
          DateTime.now().minus({ days: 1 }).toISODate(),
          DateTime.now().plus({ weeks: searchWithinWeeks[1] }).toISODate(),
        ]
    const tasks = this.searchTasks(path, dailyNoteInfo, completed, dateBounds)
    this.updateTasks([...tasks], path, dailyNoteInfo, completed)
  }

  updateTasks(
    processedTasks: TaskProps[],
    path: string,
    dailyNoteInfo: AppState['dailyNoteInfo'],
    completed: boolean
  ) {
    const updatedTasks = {
      ...getters.get('tasks'),
    }

    const newFiles = _.uniq(
      processedTasks.map((task) =>
        parseFileFromPath(
          getHeading(task, dailyNoteInfo, getters.get('settings').groupBy)
        )
      )
    )
      .filter((heading) => !this.settings.fileOrder.includes(heading))
      .sort()

    if (newFiles.length > 0) {
      const newHeadingOrder = [...this.settings.fileOrder]
      for (let heading of newFiles) {
        const afterFile = newHeadingOrder.findIndex(
          (otherHeading) => otherHeading > heading
        )
        if (afterFile === -1) newHeadingOrder.push(heading)
        else newHeadingOrder.splice(afterFile, 0, heading)
      }
      this.setSetting({
        fileOrder: newHeadingOrder,
      })
    }

    let updated = false

    const updatedIds = processedTasks.map((task) => task.id)
    const pathName = path.replace('.md', '')

    const showCompleted = getters.get('settings').showCompleted

    for (let { id } of Object.values(updatedTasks).filter(
      (task) =>
        task.id.startsWith(pathName) &&
        (showCompleted || task.completed === completed) &&
        !updatedIds.includes(task.id)
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

    const queries = _.sortBy(
      _.filter(updatedTasks, (task) => !task.completed && !!task.query),
      (task) => getParentScheduled(task, updatedTasks) ?? '99999'
    )

    const queriedIds = _.groupBy(
      _.keys(updatedTasks),
      (id) => updatedTasks[id].queryParent
    )

    const alreadyQueried: Set<string> = new Set()
    // queries "steal" children, with most earlier scheduled overriding later scheduled
    for (const task of queries) {
      invariant(task.query)

      const queriedTasks = queryTasks(task.id, task.query, updatedTasks)

      const queryChildren: string[] = []
      for (let queriedTask of queriedTasks) {
        if (alreadyQueried.has(queriedTask.id)) {
          continue
        }
        alreadyQueried.add(queriedTask.id)
        queryChildren.push(queriedTask.id)
        if (queriedTask.queryParent === task.id) continue

        alreadyQueried.add(queriedTask.id)
        updatedTasks[queriedTask.id] = {
          ...updatedTasks[queriedTask.id],
          queryParent: task.id,
        }
      }

      if (queriedIds[task.id]) {
        const unQueriedIds = _.difference(
          queriedIds[task.id],
          queriedTasks.map((x) => x.id)
        )
        for (let unQueriedId of unQueriedIds) {
          updatedTasks[unQueriedId] = {
            ...updatedTasks[unQueriedId],
            queryParent: undefined,
          }
        }
      }

      updatedTasks[task.id] = {
        ...updatedTasks[task.id],
        queryChildren,
      }
    }

    setters.set({ tasks: updatedTasks, fileOrder: this.settings.fileOrder })
  }

  updateFileOrder(file: string, before: string) {
    const beforeIndex = this.settings.fileOrder.indexOf(before)

    if (beforeIndex === -1) throw new Error('file not in headings list')
    const newFileOrder = [...this.settings.fileOrder]
    _.pull(newFileOrder, file)
    newFileOrder.splice(beforeIndex, 0, file)
    this.setSetting({ fileOrder: newFileOrder })
    setters.set({ fileOrder: newFileOrder })
  }

  async moveTask(task: TaskProps, selectedHeading: string) {
    if (task.page) {
      alert("Moving pages isn't supported yet.")
      return
    }
    const file = await this.getFile(task.path)
    invariant(file)

    const fileText = await this.app.vault.read(file)
    const lines = fileText.split('\n')

    // tasks move their subtasks as well
    let subtask = task
    while (subtask.children.length > 0) {
      subtask = getters.getTask(_.last(subtask.children)!)
    }
    const end = subtask.position.end.line
    const copyLines = lines.splice(
      task.position.start.line,
      end + 1 - task.position.start.line
    )

    await this.app.vault.modify(file, lines.join('\n'))
    const { fileName, position } = await this.findPosition(selectedHeading)
    const moveFile = await this.getFile(fileName)
    invariant(moveFile)

    await this.app.vault.process(moveFile, (text) => {
      const lines = text.split('\n')
      lines.splice(position.start.line, 0, ...copyLines)
      return lines.join('\n')
    })
    openTask({ ...task, path: fileName, position })
  }

  createNewTask = (
    newTask: Partial<TaskProps>,
    selectedHeading: string | null,
    dailyNoteInfo: AppState['dailyNoteInfo']
  ) => {
    if (!selectedHeading || selectedHeading.startsWith('Daily')) {
      const date = !newTask.scheduled
        ? (DateTime.now().toISODate() as string)
        : (DateTime.fromISO(newTask.scheduled).toISODate() as string)

      let path = parsePathFromDate(date, dailyNoteInfo)
      if (selectedHeading && selectedHeading.includes('#'))
        path += '#' + splitHeading(selectedHeading)[1]
      this.createTaskInPath(path, newTask, getters.get('showingPastDates'))
    } else {
      this.createTaskInPath(
        selectedHeading,
        newTask,
        getters.get('showingPastDates')
      )
    }
  }

  async createFileFromPath(path: string) {
    let [fileName] = path.split('#')
    if (!fileName.endsWith('.md')) fileName += '.md'

    let file = this.app.vault.getAbstractFileByPath(fileName)
    const dailyNoteInfo = getters.get('dailyNoteInfo')
    if (!(file instanceof TFile)) {
      let starterText = ''
      if (parseDateFromPath(path, dailyNoteInfo) && dailyNoteInfo.template) {
        const templateFile = await this.getFile(
          dailyNoteInfo.template +
            (dailyNoteInfo.template.endsWith('.md') ? '' : '.md')
        )
        if (templateFile) {
          starterText = await this.app.vault.read(templateFile)
        }
      }
      file = await this.app.vault.create(fileName, starterText)
    }
    if (!(file instanceof TFile)) {
      new Notice(`Time Ruler: failed to create file ${fileName}`)
      throw new Error(`Time Ruler: failed to create file ${fileName}`)
    }
    return file
  }

  private async findPosition(path: string) {
    let [fileName, heading] = path.split('#')
    if (!fileName.endsWith('.md')) fileName += '.md'

    let position = {
      start: { col: 0, line: 0, offset: 0 },
      end: { col: 0, line: 0, offset: 0 },
    }

    const file = await this.createFileFromPath(path)
    const text = await this.app.vault.read(file)
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
        const firstHeading = lines.findIndex((line) => /^#+ /.test(line))
        if (firstHeading === -1) targetLine = lines.length
        else targetLine = firstHeading
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

    return { position, fileName }
  }

  private async createTaskInPath(
    path: string,
    dropData: Partial<TaskProps>,
    completed = false
  ) {
    const { position, fileName } = await this.findPosition(path)

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
      completed,
      ...dropData,
    }

    await this.saveTask(defaultTask, true)
    openTask(defaultTask)
    setters.set({ newTask: undefined })
  }

  private async getFile(path: string) {
    let abstractFile = this.app.vault.getAbstractFileByPath(
      parseFileFromPath(path)
    )
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      await this.app.vault.create(parseFileFromPath(path), '')
      abstractFile = this.app.vault.getAbstractFileByPath(
        parseFileFromPath(path)
      )
    }

    if (abstractFile && abstractFile instanceof TFile) return abstractFile
    else return undefined
  }

  async deleteTasks(ids: string[]) {
    const tasks = getters.get('tasks')
    const deletedTaskGroups = ids.map((id) => tasks[id])
    const files = _.groupBy(deletedTaskGroups, (task) =>
      parseFileFromPath(task.path)
    )
    const updatedTasks = {}

    for (let [filePath, deletedTasks] of _.entries(files)) {
      const file = await this.getFile(filePath)
      invariant(file)
      const fileText = await this.app.vault.read(file)
      const lines = fileText.split('\n')
      for (let task of _.sortBy(
        deletedTasks,
        (task) => task.position.start.line * -1
      )) {
        lines.splice(
          task.position.start.line,
          task.position.end.line + 1 - task.position.start.line
        )

        if (task.query) {
          for (let queriedTask of _.filter(
            getters.get('tasks'),
            (queriedTask) => queriedTask.queryParent === task.id
          )) {
            updatedTasks[queriedTask.id] = _.omit(queriedTask, 'queryParent')
          }
        }
      }

      await this.app.vault.modify(file, lines.join('\n'))
    }

    setters.set(updatedTasks)
  }

  async saveTask(task: TaskProps, newTask?: boolean) {
    const file = await this.getFile(task.path)
    if (!file) return
    if (task.page) {
      this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        taskToPage(task, frontmatter)
      })
    } else {
      const fileText = await this.app.vault.read(file)
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

      await this.app.vault.modify(file, lines.join('\n'))
    }
  }

  async onload() {
    this.registerEvent(
      // @ts-ignore
      this.app.workspace.on('layout-change', (cb) => {
        console.log('layout changed', cb)

        setters.set({ recreateWindow: getters.get('recreateWindow') + 1 })
      })
    )
    this.registerEvent(
      // @ts-ignore
      this.app.workspace.on('resize', (cb) => {
        console.log('resized')

        setters.set({ recreateWindow: getters.get('recreateWindow') + 1 })
      })
    )
    this.registerEvent(
      this.app.metadataCache.on(
        // @ts-ignore
        'dataview:metadata-change',
        (...args) => {
          this.loadTasks(args[1].path, getters.get('showingPastDates'))
        }
      )
    )
  }
}

export async function getDailyNoteInfo(): Promise<
  AppState['dailyNoteInfo'] | undefined
> {
  try {
    let { folder, format, template } = (await this.app.vault
      .readConfigJson('daily-notes')
      .catch(() => {
        return { folder: undefined, format: undefined }
      })) as Record<string, string>
    if (!folder) folder = '/'
    if (!folder.endsWith('/')) folder += '/'
    if (!format) format = 'YYYY-MM-DD'
    if (!template) template = ''

    return {
      format,
      folder,
      template,
    }
  } catch (err) {
    console.warn(err)
    return {
      format: 'YYYY-MM-DD',
      folder: '/',
      template: '',
    }
  }
}

export async function openTask(task: TaskProps) {
  await this.app.workspace.openLinkText(parseFileFromPath(task.path), '')

  const mdView = this.app.workspace.getActiveViewOfType(MarkdownView)
  if (!mdView) return

  let cmEditor = mdView.editor

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

export function openTaskInRuler(id: string) {
  const task = getters.getTask(id)

  if (!task) {
    new Notice('Task not loaded in Time Ruler')
    return
  }

  const scheduled = getParentScheduled(task, getters.get('tasks'))

  if (scheduled) {
    const showingPastDates = getters.get('showingPastDates')
    const searchWithinWeeks = getters.get('searchWithinWeeks')
    const weeksAhead = Math.ceil(
      DateTime.now().diff(DateTime.fromISO(scheduled)).as('weeks')
    )
    if (showingPastDates || weeksAhead > searchWithinWeeks[1]) {
    }
    setters.set({
      showingPastDates: task.completed,
      searchWithinWeeks: [
        searchWithinWeeks[0],
        _.max([weeksAhead, searchWithinWeeks[1]]) as number,
      ],
    })
  }

  setTimeout(async () => {
    const now = toISO(DateTime.now())
    const showingPastDates = getters.get('showingPastDates')
    let section = !scheduled
      ? 'unscheduled'
      : scheduled < now && scheduled !== now.slice(0, 10) && !showingPastDates
      ? 'now'
      : scheduled.slice(0, 10)

    await scrollToSection(section)

    let tries = 0
    const findTask = () => {
      tries++
      if (tries > 10) {
        throw new Error(`Task not found: ${id} in section ${section}`)
      }
      const foundTask = document.querySelector(`[data-id="${id}"]`)

      if (!foundTask) {
        setTimeout(findTask, 250)
        return
      }

      foundTask.scrollIntoView({
        inline: 'center',
        block: 'center',
        behavior: 'smooth',
      })

      foundTask.addClass('!bg-accent')
      setTimeout(() => foundTask.removeClass('!bg-accent'), 1500)
      setTimeout(() => setters.set({ findingTask: null }))
    }

    findTask()
  })
}
