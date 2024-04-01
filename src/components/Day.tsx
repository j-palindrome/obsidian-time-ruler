import _ from 'lodash'
import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import {
  getStartDate,
  isDateISO,
  parsePathFromDate,
  parseTaskDate,
  roundMinutes,
  toISO,
} from '../services/util'
import Block, { BlockProps } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Hours from './Hours'
import { TimeSpanTypes } from './Minutes'
import { Timer } from './Timer'

export default function Day({
  startISO,
  endISO,
  type,
  dragContainer,
  isNow,
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  dragContainer: string
  isNow?: boolean
}) {
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const now = toISO(roundMinutes(DateTime.now()))

  const startDate = getStartDate(DateTime.fromISO(startISO))
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const id = startDate
  /**
   * find the nearest scheduled date in parents (include ALL tasks which will be in this block). Day -> Hours -> Block all take a single flat list of scheduled tasks, which they use to calculate total length of the block. Blocks group them by parent -> filepath/heading, calculating queries and unscheduled parents.
   */
  const [allDay, blocksByTime] = useAppStore((state) => {
    const allDay: BlockProps = {
      startISO: startDate,
      endISO: startDate,
      blocks: [],
      tasks: [],
      events: [],
    }
    const blocksByTime: Record<string, BlockProps> = {}
    _.forEach(state.tasks, (task) => {
      const scheduled = parseTaskDate(task)

      const isShown =
        (task.due || scheduled) &&
        !task.queryParent &&
        (showCompleted || task.completed === showingPastDates)
      if (!isShown) return

      const scheduledForToday = !scheduled
        ? false
        : isNow
        ? isDateISO(scheduled)
          ? showingPastDates
            ? scheduled >= startDate
            : scheduled <= startDate
          : showingPastDates
          ? scheduled >= startISO
          : scheduled < endISO
        : isDateISO(scheduled)
        ? scheduled === startDate
        : scheduled >= startISO && scheduled < endISO

      const dueToday =
        !showingPastDates &&
        (!task.due ? false : isNow || task.due >= startDate) &&
        (!task.scheduled || task.scheduled < startDate)

      if (scheduledForToday) {
        invariant(scheduled)
        if (isDateISO(scheduled)) {
          allDay.tasks.push(task)
        } else {
          if (blocksByTime[scheduled]) blocksByTime[scheduled].tasks.push(task)
          else
            blocksByTime[scheduled] = {
              startISO: scheduled,
              endISO: scheduled,
              tasks: [task],
              events: [],
              blocks: [],
            }
        }
      } else if (dueToday) {
        allDay.tasks.push(task)
      }
    })

    for (let event of _.filter(state.events, (event) =>
      isDateISO(event.startISO)
        ? event.startISO <= startDate && event.endISO >= startDate
        : event.endISO > startISO &&
          event.startISO < endISO &&
          (showingPastDates ? event.startISO <= now : event.endISO >= now)
    )) {
      if (isDateISO(event.startISO)) allDay.events.push(event)
      else if (blocksByTime[event.startISO])
        blocksByTime[event.startISO].events.push(event)
      else
        blocksByTime[event.startISO] = {
          startISO: event.startISO,
          endISO: event.endISO,
          tasks: [],
          events: [event],
          blocks: [],
        }
    }

    return [allDay, blocksByTime]
  }, shallow)

  let blocks = _.map(_.sortBy(_.entries(blocksByTime), 0), 1)

  const viewMode = useAppStore((state) => state.settings.viewMode)
  const calendarMode = viewMode === 'week'

  let title = isNow
    ? 'Today'
    : DateTime.fromISO(startISO || endISO).toFormat(
        calendarMode ? 'EEE d' : 'EEE, MMM d'
      )

  const collapsed = useAppStore((state) => state.collapsed[id])

  const foundTaskInAllDay = useAppStore((state) => {
    return state.findingTask &&
      allDay.tasks.find((task) => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && collapsed) {
      setters.patchCollapsed([id], false)
      const foundTask = allDay.tasks.find(
        (task) => task.id === foundTaskInAllDay
      ) as TaskProps
      if (!foundTask) return
      setters.set({ findingTask: null })
      setTimeout(() => openTaskInRuler(foundTask.id))
    }
  }
  useEffect(expandIfFound, [foundTaskInAllDay])

  const allDayFrame = useRef<HTMLDivElement>(null)
  const [allDayHeight, setAllDayHeight] = useState<string | undefined>()

  const wide = useAppStore((state) => state.childWidth > 1)

  const TR_NOW = 'TR::NOW'
  const focus = useAppStore((state) => isNow && state.collapsed[TR_NOW])

  if (focus) {
    endISO =
      blocks.find(({ startISO }) => startISO && startISO > now)?.endISO ?? now
    blocks = blocks.filter(({ startISO }) => startISO && startISO <= now)
  }

  return (
    <div className={`flex flex-col overflow-hidden relative`}>
      <div className='flex items-center group relative z-10'>
        <Droppable
          data={{ scheduled: startDate }}
          id={dragContainer + '::' + startISO + '::timeline'}
        >
          <div className='flex items-center grow'>
            <div className='flex-none w-indent pr-1'>
              <Button
                className='flex-none w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                src={collapsed ? 'chevron-right' : 'chevron-down'}
                onClick={() => {
                  setters.patchCollapsed([id], !collapsed)
                  return false
                }}
              />
            </div>

            <div
              className='font-menu w-full cursor-pointer hover:underline'
              onClick={async () => {
                const dailyNoteInfo = getters.get('dailyNoteInfo')
                const path = parsePathFromDate(startDate, dailyNoteInfo)
                const thisNote = app.vault.getAbstractFileByPath(path)
                if (!thisNote) {
                  await getters.getObsidianAPI().createFileFromPath(path)
                }
                app.workspace.openLinkText(
                  parsePathFromDate(startDate, dailyNoteInfo),
                  ''
                )
              }}
            >
              {title || ''}
            </div>
          </div>
        </Droppable>
      </div>
      {isNow && <Timer />}
      <div
        className={`rounded-icon ${
          {
            hour: wide
              ? 'h-0 grow flex space-x-2 child:h-full child:flex-1 child:w-full justify-center child:max-w-xl'
              : 'h-0 grow flex flex-col',
            day: 'overflow-y-auto',
            week: 'overflow-y-auto',
          }[viewMode]
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        {allDay.tasks.length + allDay.events.length > 0 && (
          <div
            className={`relative w-full child:mb-1 overflow-x-hidden rounded-icon mt-1 ${
              {
                hour: wide
                  ? '!h-full'
                  : 'max-h-[50%] flex-none overflow-y-auto resize-y',
                day: 'h-fit',
                week: 'h-fit',
              }[viewMode]
            } ${collapsed ? 'hidden' : 'block'}`}
            style={{
              height: viewMode === 'hour' ? allDayHeight : '',
            }}
            data-auto-scroll={calendarMode ? undefined : 'y'}
            ref={allDayFrame}
          >
            {allDay.events.map((event) => (
              <Block
                type='event'
                events={[event]}
                key={event.id}
                id={event.id}
                tasks={[]}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer}
                blocks={[]}
              />
            ))}
            {allDay.tasks.length > 0 && (
              <Block
                type='all-day'
                events={[]}
                tasks={allDay.tasks}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer}
                blocks={[]}
              />
            )}
          </div>
        )}
        <div
          className={`flex flex-col ${
            {
              hour: 'h-0 grow overflow-y-auto',
              day: 'h-fit',
              week: 'h-fit',
            }[viewMode]
          }`}
        >
          {isNow && (
            <div className='w-full flex flex-none h-6 mt-1 items-center'>
              <Droppable
                id={`${dragContainer}::now`}
                data={{
                  scheduled: now,
                }}
              >
                <div className='h-full grow flex font-menu items-center space-x-2 pl-indent'>
                  <span className='text-xs'>Now</span>
                  <hr className='w-full border-selection'></hr>
                </div>
              </Droppable>
              <Button
                className=''
                src={focus ? 'maximize-2' : 'minimize-2'}
                onClick={() => {
                  if (!focus) {
                    setters.patchCollapsed([id], true)
                  }
                  setters.patchCollapsed([TR_NOW], !focus)
                }}
              />
            </div>
          )}
          <div
            className={`overflow-x-hidden rounded-icon mt-1 h-full`}
            data-auto-scroll={calendarMode ? undefined : 'y'}
          >
            <Hours
              {...{
                startISO,
                endISO,
                type,
                blocks,
                dragContainer,
              }}
            />
            <Droppable
              data={{ scheduled: startISO }}
              id={`${dragContainer}::${startISO}::timeline::end`}
            >
              <div className='h-0 grow'></div>
            </Droppable>
          </div>
        </div>
      </div>
    </div>
  )
}
