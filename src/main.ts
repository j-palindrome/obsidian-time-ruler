import { App, MarkdownFileInfo, MarkdownView, Notice, Plugin } from 'obsidian'
import { getAPI } from 'obsidian-dataview'
import TimeRulerView, { TIME_RULER_VIEW as TIME_RULER } from './index'
import SettingsTab from './plugin/SettingsTab'
import { openTaskInRuler } from './services/obsidianApi'

export type FieldFormat = 'tasks' | 'dataview' | 'full-calendar'
interface TimeRulerSettings {
  calendars: string[]
  fieldFormat: FieldFormat
  muted: boolean
  inbox: string | null
}

const DEFAULT_SETTINGS: TimeRulerSettings = {
  calendars: [],
  muted: false,
  fieldFormat: 'dataview',
  inbox: null
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

    this.registerView(TIME_RULER, leaf => new TimeRulerView(leaf, this))

    this.addCommand({
      icon: 'ruler',
      callback: () => this.activateView(true),
      id: 'obsidian-time-ruler-activate-view',
      name: 'Open Time Ruler'
    })

    // just for development
    this.activateView()

    this.registerEvent(this.app.workspace.on('editor-menu', this.openMenu))

    this.addCommand({
      id: 'obsidian-time-ruler_find-task',
      name: 'Reveal in Time Ruler',
      checkCallback: checking => {
        this.app.workspace.getActiveFile()
      },
      editorCallback: (_, context) => this.jumpToTask(context)
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
    const alreadyOpenTimeRulers = this.app.workspace.getLeavesOfType(TIME_RULER)
    if (alreadyOpenTimeRulers.length === 0) await this.activateView(true)
    openTaskInRuler(cursor.line, path)
  }

  openMenu(menu, _, context) {
    const cursor = context.editor?.getCursor()
    if (!cursor) return
    const line = context.editor?.getLine(cursor.line)
    if (!line || !/ *- \[ \] /.test(line)) return
    menu.addItem(item =>
      item
        .setIcon('ruler')
        .setTitle('Reveal in Time Ruler')
        .onClick(() => this.jumpToTask(context))
    )
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(TIME_RULER)
  }

  findInView() {
    const view = this.app.workspace.getLeavesOfType(TIME_RULER)[0]
    view.setEphemeralState
  }

  async activateView(active = false) {
    const dataViewPlugin = getAPI(this.app)
    if (!dataViewPlugin) {
      new Notice('Please enable the DataView plugin for Time Ruler to work.')
      this.app.workspace.detachLeavesOfType(TIME_RULER)
      return
    }

    const alreadyOpenRiverbanks = this.app.workspace.getLeavesOfType(TIME_RULER)
    const leaf =
      alreadyOpenRiverbanks?.[0] ?? this.app.workspace.getRightLeaf(false)

    await leaf.setViewState({
      type: TIME_RULER,
      active
    })
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(TIME_RULER)[0]
    )
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) }
  }

  saveSettings() {
    this.saveData(this.settings)
  }
}
