import _, { filter } from 'lodash'
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
  const endDate = getStartDate(DateTime.fromISO(startISO).plus({ day: 1 }))
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const id = startDate
  /**
   * find the nearest scheduled date in parents (include ALL tasks which will be in this block). Day -> Hours -> Block all take a single flat list of scheduled tasks, which they use to calculate total length of the block. Blocks group them by parent -> filepath/heading, calculating queries and unscheduled parents.
   */
  const [allDay, blocksByTime, pastTasks, upcoming] = useAppStore((state) => {
    const allDay: BlockProps = {
      startISO: startDate,
      endISO: startDate,
      blocks: [],
      tasks: [],
      events: [],
    }
    const pastTasks: BlockProps = {
      startISO: startDate,
      endISO: startDate,
      blocks: [],
      tasks: [],
      events: [],
    }
    const upcoming: BlockProps = {
      startISO: startDate,
      endISO: startDate,
      blocks: [],
      tasks: [],
      events: [],
    }
    const blocksByTime: Record<string, BlockProps> = {}
    _.forEach(state.tasks, (task) => {
      const scheduled = parseTaskDate(task, state.tasks)

      const isShown =
        (task.due || scheduled) &&
        !task.queryParent &&
        ((showCompleted && scheduled === startDate) ||
          task.completed === showingPastDates)
      if (!isShown) return

      const scheduledPast =
        !isNow || !scheduled
          ? false
          : showingPastDates
          ? scheduled >= endDate
          : scheduled < startDate

      const scheduledForToday = !scheduled
        ? false
        : isDateISO(scheduled)
        ? scheduled === startDate
        : scheduled >= startISO && scheduled < endISO

      const dueToday =
        !showingPastDates &&
        (!task.due ? false : isNow || task.due >= startDate) &&
        (!task.scheduled || task.scheduled < startDate)

      if (scheduledPast) {
        invariant(scheduled)
        pastTasks.tasks.push(task)
      } else if (scheduledForToday) {
        invariant(scheduled)
        if (
          isDateISO(scheduled) ||
          scheduled < startDate ||
          scheduled > endISO
        ) {
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
        upcoming.tasks.push(task)
      }
    })

    for (let event of _.filter(state.events, (event) => {
      const shouldInclude = isDateISO(event.startISO)
        ? event.startISO <= startDate && event.endISO > startDate
        : event.startISO < endISO &&
          event.endISO > startISO &&
          (showingPastDates ? event.startISO <= now : event.endISO >= now)
      return shouldInclude
    })) {
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
    return [allDay, blocksByTime, pastTasks, upcoming]
  }, shallow)

  let blocks = _.map(
    _.sortBy(_.entries(blocksByTime), (x) => x[0] > startISO, 0),
    1
  )

  const viewMode = useAppStore((state) => state.settings.viewMode)
  const calendarMode = viewMode === 'week'

  let title = DateTime.fromISO(startISO || endISO).toFormat(
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

  const wide = useAppStore((state) => state.childWidth > 1)

  return (
    <div className={`flex flex-col overflow-hidden h-full relative`}>
      <div className='flex items-center group relative z-10'>
        <Droppable
          data={{ scheduled: startDate }}
          id={dragContainer + '::' + startISO + '::timeline'}
        >
          <div className='flex items-center grow'>
            <div className='flex-none w-indent pr-1'>
              <Button
                className='flex-none w-full'
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
                const thisNote = getters
                  .getApp()
                  .vault.getAbstractFileByPath(path)
                if (!thisNote) {
                  await getters.getObsidianAPI().createFileFromPath(path)
                }
                getters
                  .getApp()
                  .workspace.openLinkText(
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
      <div
        className={`rounded-icon ${
          {
            one: 'overflow-hidden h-full flex flex-col',
            day: 'overflow-hidden h-full flex flex-col',
            week: 'overflow-y-auto',
          }[viewMode]
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        {allDay.tasks.length +
          allDay.events.length +
          pastTasks.tasks.length +
          upcoming.tasks.length >
          0 && (
          <div
            className={`relative w-full child:mb-1 overflow-x-hidden rounded-icon mt-1 ${
              {
                one: 'h-fit flex-none flex flex-col max-h-[50%] overflow-y-auto',
                day: 'h-fit flex-none flex flex-col max-h-[50%] overflow-y-auto',
                week: 'h-fit',
              }[viewMode]
            } ${collapsed ? 'hidden' : 'block'}`}
            data-auto-scroll={calendarMode ? undefined : 'y'}
            ref={allDayFrame}
          >
            {pastTasks.tasks.length > 0 && (
              <Block
                type='all-day'
                title='past'
                events={[]}
                tasks={pastTasks.tasks}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer + '-past'}
                blocks={[]}
              />
            )}
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
                title='today'
                events={[]}
                tasks={allDay.tasks}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer + '-allDay'}
                blocks={[]}
              />
            )}

            {upcoming.tasks.length > 0 && (
              <Block
                type='upcoming'
                title='upcoming'
                events={[]}
                tasks={upcoming.tasks}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer + '-upcoming'}
                blocks={[]}
              />
            )}
          </div>
        )}
        <div
          className={`flex flex-col h-full flex-1 ${
            {
              one: 'overflow-y-auto',
              day: 'overflow-y-auto',
              week: 'h-fit',
            }[viewMode]
          }`}
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
  )
}
