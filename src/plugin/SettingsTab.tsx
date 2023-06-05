import $ from 'jquery'
import _ from 'lodash'
import {
  Notice,
  PluginSettingTab,
  Setting,
  TextComponent,
  ValueComponent,
  request,
  setIcon
} from 'obsidian'
import { useEffect, useRef } from 'react'
import { Root, createRoot } from 'react-dom/client'
import TimeRulerPlugin, { FieldFormat } from '../main'

const WEBCAL = 'webcal'

function Calendars({
  plugin,
  names,
  updateCalendars
}: {
  plugin: TimeRulerPlugin
  names: Record<string, string>
  updateCalendars: () => void
}) {
  useEffect(() => {
    $(frameRef.current as HTMLElement)
      .find('button')
      .each((_i, el) => setIcon(el, 'x'))
  })
  const frameRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={frameRef} style={{ paddingBottom: '8px' }}>
      {plugin.settings.calendars.map(calendar => (
        <div
          key={calendar}
          style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
          <button
            style={{ marginRight: '4px' }}
            onClick={() => {
              if (!confirm('Remove this calendar?')) return
              _.pull(plugin.settings.calendars, calendar)
              plugin.saveSettings()
              updateCalendars()
            }}
            data-role='time-ruler-delete'></button>
          <div>{names[calendar]}</div>
        </div>
      ))}
    </div>
  )
}

export default class SettingsTab extends PluginSettingTab {
  plugin: TimeRulerPlugin
  searcher: ValueComponent<string>
  calendarDisplay: HTMLDivElement
  names: Record<string, string>
  root: Root

  constructor(plugin: TimeRulerPlugin) {
    super(app, plugin)
    this.plugin = plugin
    this.names = {}
  }

  updateCalendars() {
    this.root.render(
      <Calendars
        plugin={this.plugin}
        names={this.names}
        updateCalendars={() => this.updateCalendars()}
      />
    )
  }

  async addCalendarName(calendar: string) {
    const data = await request(calendar)
    const name = data.match(/CALNAME:(.*)/)?.[1] ?? 'Default'
    this.names[calendar] = name
  }

  async display() {
    let { containerEl } = this
    containerEl.empty()

    const format = new Setting(containerEl)
      .setName('Field Format')
      .setDesc(
        'Choose which style of inline fields to use (parses scheduled date or time, due, priority, completion, and start).'
      )
    format.addDropdown(dropdown => {
      dropdown.addOptions({
        dataview: 'Dataview',
        'full-calendar': 'Full Calendar',
        tasks: 'Tasks'
      })
      dropdown.setValue(this.plugin.settings.fieldFormat)
      dropdown.onChange((value: FieldFormat) => {
        this.plugin.settings.fieldFormat = value
        this.plugin.saveSettings()
      })
    })

    const div = $(/*html*/ `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px">
        This setting is only used to edit tasks. Time Ruler parses any relevant fields from the Tasks, Full Calendar, and Dataview plugins. When it edits tasks, it converts them back to your preferred format. 
      </div>
    `)[0]
    containerEl.appendChild(div)

    new Setting(containerEl)
      .setName('Muted')
      .setDesc('Turn off playing sounds on task completion.')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.muted)
        toggle.onChange(value => {
          this.plugin.settings.muted = value
          this.plugin.saveSettings()
        })
      })

    let newCalendarLink: TextComponent
    new Setting(containerEl)
      .setName('Calendars')
      .setDesc('View readonly calendars in Time Ruler.')
      .addText(text => {
        newCalendarLink = text
        text.inputEl.style.width = '100%'
        text.setPlaceholder('Calendar Share Link (iCal format)')
      })
      .addButton(button => {
        button.setIcon('plus')
        button.onClick(async () => {
          let newValue = newCalendarLink.getValue()
          if (newValue.startsWith(WEBCAL)) {
            newValue = 'https' + newValue.slice(WEBCAL.length)
          }
          try {
            await this.addCalendarName(newValue)
            this.plugin.settings.calendars.push(newValue)
            this.plugin.settings.calendars = _.uniq(
              this.plugin.settings.calendars
            )
            this.plugin.saveSettings()

            newCalendarLink.setValue('')
            this.updateCalendars()
          } catch (err) {
            new Notice('Time Ruler: Error creating calendar - ' + err.message)
          }
        })
      })

    this.calendarDisplay = containerEl.appendChild(createEl('div'))
    this.root = createRoot(this.calendarDisplay)

    new Setting(containerEl).setDesc(
      'Reopen the Time Ruler view for changes to take effect.'
    )

    await Promise.all(
      this.plugin.settings.calendars.map(calendar =>
        this.addCalendarName(calendar)
      )
    )
    this.updateCalendars()
  }
}
