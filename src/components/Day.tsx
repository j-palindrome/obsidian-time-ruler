import _ from 'lodash'
import { DateTime } from 'luxon'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import {
  formatHeadingTitle,
  getParents,
  getToday,
  isDateISO,
  nestedScheduled,
  parseHeadingFromPath,
  parseTaskDate,
  roundMinutes,
  toISO,
} from '../services/util'
import Block, { BlockProps, UNGROUPED } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Hours from './Hours'
import { TimeSpanTypes } from './Minutes'
import Task from './Task'
import { TaskPriorities } from '../types/enums'
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
  isNow?: true
}) {
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const now = toISO(roundMinutes(DateTime.now()))

  const startDate = startISO.slice(0, 10)
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const id = isNow ? 'now' : startDate
  /**
   * find the nearest scheduled date in parents (include ALL tasks which will be in this block). Day -> Hours -> Block all take a single flat list of scheduled tasks, which they use to calculate total length of the block. Blocks group them by parent -> filepath/heading, calculating queries and unscheduled parents.
   */
  const [allDay, blocksByTime, deadlines] = useAppStore((state) => {
    const allDay: BlockProps = {
      startISO: startDate,
      endISO: startDate,
      blocks: [],
      tasks: [],
      events: [],
    }
    const blocksByTime: Record<string, BlockProps> = {}
    const deadlines: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const scheduled = parseTaskDate(task)

      const isShown =
        (task.due || (scheduled && !task.queryParent)) &&
        (showCompleted || task.completed === showingPastDates)
      if (!isShown) return

      const scheduledForToday = !scheduled
        ? false
        : isNow
        ? isDateISO(scheduled)
          ? showingPastDates
            ? scheduled > startDate
            : scheduled < startDate
          : showingPastDates
          ? scheduled > startISO
          : scheduled < endISO
        : isDateISO(scheduled)
        ? scheduled === startDate
        : scheduled >= startISO && scheduled < endISO

      const dueToday = !task.due ? false : task.due >= startDate

      if (dueToday) {
        deadlines.push(task)
      }

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
      }
    })

    for (let event of _.filter(
      state.events,
      (event) =>
        event.endISO > startISO &&
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

    return [allDay, blocksByTime, deadlines]
  }, shallow)

  const blocks = _.map(_.sortBy(_.entries(blocksByTime), 0), 1)

  const viewMode = useAppStore((state) => state.settings.viewMode)
  const calendarMode = viewMode === 'week'

  let title = isNow
    ? 'Now'
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

  return (
    <div className={`flex flex-col overflow-hidden relative`}>
      <div className='flex items-center group relative z-10'>
        <Droppable
          data={{ scheduled: isNow ? now : startDate }}
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

            <div className='font-menu w-full'>{title || ''}</div>
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
        {deadlines.length + allDay.tasks.length + allDay.events.length > 0 && (
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
            {deadlines.length > 0 && (
              <div className='rounded-icon bg-code'>
                {_.sortBy(deadlines, 'due', 'scheduled').map((task) => (
                  <Task
                    key={task.id}
                    renderType='deadline'
                    subtasks={[]}
                    dragContainer={dragContainer}
                    {...task}
                  />
                ))}
              </div>
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
                type='event'
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
          className={`overflow-x-hidden rounded-icon mt-1 ${
            {
              hour: 'h-0 grow overflow-y-auto',
              day: 'h-fit',
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
