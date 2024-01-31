import $ from 'jquery'
import _ from 'lodash'
import {
  Notice,
  PluginSettingTab,
  Setting,
  TextComponent,
  ValueComponent,
  request,
  setIcon,
} from 'obsidian'
import { useEffect, useRef } from 'react'
import { Root, createRoot } from 'react-dom/client'
import TimeRulerPlugin from '../main'

const WEBCAL = 'webcal'

function Calendars({
  plugin,
  names,
  updateCalendars,
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
      {plugin.settings.calendars.map((calendar) => (
        <div
          key={calendar}
          style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}
        >
          <button
            style={{ marginRight: '4px' }}
            onClick={() => {
              if (!confirm('Remove this calendar?')) return
              _.pull(plugin.settings.calendars, calendar)
              plugin.saveSettings()
              updateCalendars()
            }}
            data-role='time-ruler-delete'
          ></button>
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

    new Setting(containerEl).setDesc(
      'Reload the Time Ruler view for changes to take effect.'
    )

    const format = new Setting(containerEl)
      .setName('Preferred Field Format')
      .setDesc(
        'Choose which style of inline fields to use as a default (parses scheduled date/time, due, priority, completion, reminder, and start).'
      )
    format.addDropdown((dropdown) => {
      dropdown.addOptions({
        dataview: 'Dataview',
        'full-calendar': 'Full Calendar',
        tasks: 'Tasks',
        simple: 'Day Planner',
      })
      dropdown.setValue(this.plugin.settings.fieldFormat)
      dropdown.onChange((value: FieldFormat['main']) => {
        this.plugin.settings.fieldFormat = value
        this.plugin.saveSettings()
      })
    })

    new Setting(containerEl)
      .setName('Muted')
      .setDesc('Turn off playing sounds on task completion.')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.muted)
        toggle.onChange((value) => {
          this.plugin.settings.muted = value
          this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('Timer Event')
      .setDesc('Toggle the event triggered on timer end.')
      .addDropdown((dropdown) => {
        dropdown.addOptions({
          notification: 'Notification',
          sound: 'Sound',
        })
        dropdown.setValue(this.plugin.settings.timerEvent)
        dropdown.onChange((value: 'notification' | 'sound') => {
          this.plugin.settings.timerEvent = value
          this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('Borders')
      .setDesc('Toggle borders around days.')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.borders)
        toggle.onChange((value) => {
          this.plugin.settings.borders = value
          this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName('24 Hour Format')
      .setDesc(
        'Toggle between AM/PM hours and 24-hour format in the Time Ruler.'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.twentyFourHourFormat)
          .onChange((value) => {
            this.plugin.settings.twentyFourHourFormat = value
            this.plugin.saveSettings()
          })
      })

    const dayStartEnd = new Setting(containerEl)
      .setName('Day Start & End')
      .setDesc('Choose the boundaries of the Time Ruler hour tick-marks.')
    const hourStart = createSpan()
    hourStart.setText('start')
    dayStartEnd.controlEl.appendChild(hourStart)
    dayStartEnd.addDropdown((component) => {
      let options: Record<string, string> = {}
      for (let i = 0; i < 13; i++) {
        options[`${i}`] = `${i}:00`
      }
      component
        .addOptions(options)
        .setValue(String(this.plugin.settings.dayStartEnd[0]))
        .onChange((newValue) => {
          this.plugin.settings.dayStartEnd = [
            parseInt(newValue),
            this.plugin.settings.dayStartEnd[1],
          ]
          this.plugin.saveSettings()
        })
    })
    const hourEnd = createSpan()
    hourEnd.setText('end')
    dayStartEnd.controlEl.appendChild(hourEnd)
    dayStartEnd.addDropdown((component) => {
      let options: Record<string, string> = {}
      for (let i = 0; i < 24; i++) {
        options[`${i}`] = `${i}:00`
      }
      component
        .addOptions(options)
        .setValue(String(this.plugin.settings.dayStartEnd[1]))
        .onChange((newValue) => {
          this.plugin.settings.dayStartEnd = [
            this.plugin.settings.dayStartEnd[0],
            parseInt(newValue),
          ]
          this.plugin.saveSettings()
        })
    })

    new Setting(containerEl)
      .setName('Extend Blocks to Next')
      .setDesc(
        'Extend blocks without defined length to the start of the next block.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.extendBlocks).onChange((value) => {
          this.plugin.settings.extendBlocks = value
          this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Custom Filter')
      .setDesc(
        `Enable a custom Dataview filter to filter tasks (at the document level) which is passed to dv.pages('<custom filter>')`
      )
      .addText((text) => {
        text
          .setPlaceholder(`dv.pages('<custom filter>')`)
          .setValue(this.plugin.settings.search)
          .onChange((value) => {
            this.plugin.settings.search = value
            this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Filter Function')
      .setDesc(
        `Provide a filter function that takes a task DataArray from dv.pages()['file']['tasks'] and returns the filtered array.`
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(
            `example: (tasks) => tasks.where(task => task["customProperty"] === true)`
          )
          .setValue(this.plugin.settings.filterFunction)
          .onChange((value) => {
            this.plugin.settings.filterFunction = value
            this.plugin.saveSettings()
          })
          .inputEl.style.setProperty('width', '100%')
      })
      .controlEl.style.setProperty('width', '100%')

    new Setting(containerEl)
      .setName('Task Filter')
      .setDesc('Only include tasks which match the following search.')
      .addText((text) =>
        text
          .setPlaceholder('Match text in tasks')
          .setValue(this.plugin.settings.taskSearch)
          .onChange((value) => {
            this.plugin.settings.taskSearch = value
            this.plugin.saveSettings()
          })
      )

    const customStatuses = new Setting(containerEl)
      .setName('Custom Statuses')
      .setDesc(
        'Include only, or exclude certain, characters between the double brackets [ ] of a task. Write characters with no separation.'
      )
    customStatuses.controlEl.appendChild($(/*html*/ `<span>Exclude</span>`)[0])
    customStatuses.addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.customStatus.include)
        .setTooltip('Exclude the current value')
    )
    customStatuses.controlEl.appendChild($(/*html*/ `<span>Include</span>`)[0])
    customStatuses.addText((text) => {
      text
        .setValue(this.plugin.settings.customStatus.statuses)
        .setPlaceholder('Statuses')
        .onChange((value) => {
          this.plugin.settings.customStatus.statuses = value
          this.plugin.saveSettings()
        })
    })

    new Setting(containerEl)
      .setName('Show Completed')
      .setDesc('Show completed tasks')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCompleted)
          .onChange((value) => {
            this.plugin.settings.showCompleted = value
            this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Add Tasks to End')
      .setDesc('Toggle adding new tasks to the start or end of headings/files.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.addTaskToEnd).onChange((value) => {
          this.plugin.settings.addTaskToEnd = value
          this.plugin.saveSettings()
        })
      )

    let newCalendarLink: TextComponent
    new Setting(containerEl)
      .setName('Calendars')
      .setDesc('View readonly calendars in Time Ruler.')
      .addText((text) => {
        newCalendarLink = text
        text.inputEl.style.width = '100%'
        text.setPlaceholder('Calendar Share Link (iCal format)')
      })
      .addButton((button) => {
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

    await Promise.all(
      this.plugin.settings.calendars.map((calendar) =>
        this.addCalendarName(calendar)
      )
    )
    this.updateCalendars()
  }
}
