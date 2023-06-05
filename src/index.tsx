import { ItemView, WorkspaceLeaf } from 'obsidian'
import * as React from 'react'
import { Root, createRoot } from 'react-dom/client'
import TimeRulerPlugin from './main'
import App from './components/App'
import ObsidianAPI from './services/obsidianApi'
import CalendarAPI from './services/calendarApi'
import _ from 'lodash'

export const RIVERBANK_VIEW = 'time-ruler-view'

export default class AppView extends ItemView {
  plugin: TimeRulerPlugin
  obsidianAPI: ObsidianAPI
  calendarLinkAPI: CalendarAPI
  root: Root

  constructor(leaf: WorkspaceLeaf, plugin: TimeRulerPlugin) {
    super(leaf)
    this.plugin = plugin
    this.navigation = false
    this.icon = 'ruler'
  }

  getViewType() {
    return RIVERBANK_VIEW
  }

  getDisplayText() {
    return 'Time Ruler'
  }

  async onOpen() {
    this.obsidianAPI = new ObsidianAPI(this.plugin.settings)
    this.calendarLinkAPI = new CalendarAPI(
      this.plugin.settings.calendars,
      calendar => {
        _.pull(this.plugin.settings.calendars, calendar)
        this.plugin.saveSettings()
      }
    )

    this.root = createRoot(this.containerEl.children[1])
    this.root.render(
      <React.StrictMode>
        <App
          apis={{
            obsidian: this.obsidianAPI,
            calendar: this.calendarLinkAPI
          }}
        />
      </React.StrictMode>
    )
  }

  async onClose() {
    this.root.unmount()
    this.obsidianAPI.unload()
    this.calendarLinkAPI.unload()
  }
}
