import { App, MarkdownFileInfo, MarkdownView, Notice, Plugin } from 'obsidian'
import { getAPI } from 'obsidian-dataview'
import TimeRulerView, { TIME_RULER_VIEW } from './index'
import SettingsTab from './plugin/SettingsTab'
import { openTaskInRuler } from './services/obsidianApi'

interface TimeRulerSettings {
  calendars: string[]
  fieldFormat: FieldFormat['main']
  muted: boolean
  inbox: string | null
  search: string
  fileOrder: string[]
  customStatus: {
    include: boolean
    statuses: string
  }
}

export const DEFAULT_SETTINGS: TimeRulerSettings = {
  calendars: [],
  fieldFormat: 'dataview',
  muted: false,
  inbox: null,
  search: '',
  fileOrder: [],
  customStatus: {
    include: false,
    statuses: '-',
  },
}

export default class TimeRulerPlugin extends Plugin {
  settings: TimeRulerSettings

  constructor(app: App, manifest: any) {
    super(app, manifest)
    this.saveSettings = this.saveSettings.bind(this)
  }

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new SettingsTab(this))

    this.registerView(TIME_RULER_VIEW, (leaf) => new TimeRulerView(leaf, this))

    this.addCommand({
      icon: 'ruler',
      callback: () => this.activateView(),
      id: 'activate-view',
      name: 'Open Time Ruler',
    })

    this.addRibbonIcon('ruler', 'Open Time Ruler', () => this.activateView())

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, _, context) =>
        this.openMenu(menu, context)
      )
    )

    this.addCommand({
      id: 'find-task',
      name: 'Reveal in Time Ruler',
      icon: 'ruler',
      checkCallback: () => {
        this.app.workspace.getActiveFile()
      },
      editorCallback: (_, context) => this.jumpToTask(context),
    })
  }

  async jumpToTask(context: MarkdownView | MarkdownFileInfo) {
    const path = context.file?.path
    if (!path) return
    const cursor = context.editor?.getCursor()
    if (!cursor) return
    const line = context.editor?.getLine(cursor.line)
    if (!line || !/ *- \[ \] /.test(line)) {
      new Notice('cursor is not on task')
      return
    }

    await this.activateView()
    openTaskInRuler(cursor.line, path)
  }

  openMenu(menu, context) {
    const cursor = context.editor?.getCursor()
    if (!cursor) return
    const line = context.editor?.getLine(cursor.line)
    if (!line || !/ *- \[ \] /.test(line)) return
    menu.addItem((item) =>
      item
        .setIcon('ruler')
        .setTitle('Reveal in Time Ruler')
        .onClick(() => this.jumpToTask(context))
    )
  }

  async activateView() {
    let dataViewPlugin = getAPI(this.app)
    if (!dataViewPlugin) {
      // wait for Dataview plugin to load (usually <100ms)
      dataViewPlugin = await new Promise((resolve) => {
        setTimeout(() => resolve(getAPI(this.app)), 350)
      })
      if (!dataViewPlugin) {
        new Notice('Please enable the DataView plugin for Time Ruler to work.')
        this.app.workspace.detachLeavesOfType(TIME_RULER_VIEW)
        return
      }
    }

    const leaf =
      this.app.workspace.getLeavesOfType(TIME_RULER_VIEW)?.[0] ??
      this.app.workspace.getRightLeaf(false)

    await leaf.setViewState({
      type: TIME_RULER_VIEW,
      active: true,
    })

    this.app.workspace.revealLeaf(leaf)
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) }
  }

  saveSettings() {
    this.saveData(this.settings)
  }
}
