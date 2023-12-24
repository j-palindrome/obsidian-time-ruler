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
} from '../services/util'
import Block, { BlockProps, UNGROUPED } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Hours from './Hours'
import { TimeSpanTypes } from './Minutes'
import Task from './Task'
import { TaskPriorities } from '../types/enums'

export default function Day({
  startISO,
  endISO,
  type,
  dragContainer,
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  dragContainer: string
}) {
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const now = DateTime.now().toISO() as string

  const startDate = startISO.slice(0, 10)
  const isToday = startDate === getToday()
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  /**
   * find the nearest scheduled date in parents (include ALL tasks which will be in this block). Day -> Hours -> Block all take a single flat list of scheduled tasks, which they use to calculate total length of the block. Blocks group them by parent -> filepath/heading, calculating queries and unscheduled parents.
   */
  const [blocksByTime, deadlines] = useAppStore((state) => {
    const blocksByTime: Record<string, BlockProps> = {
      [startDate]: {
        startISO: startDate,
        endISO: startDate,
        blocks: [],
        tasks: [],
        events: [],
      },
    }
    const deadlines: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const isShown =
        (task.due || (task.scheduled && !task.queryParent)) &&
        (showCompleted || (showingPastDates ? task.completed : !task.completed))
      if (!isShown) return

      const scheduled = parseTaskDate(task)

      const scheduledForToday = !scheduled
        ? false
        : isToday
        ? scheduled <= endISO
        : isDateISO(scheduled)
        ? scheduled === startDate
        : scheduled >= startISO && scheduled < endISO

      const dueToday = !task.due ? false : task.due >= startDate

      if (dueToday) {
        deadlines.push(task)
      } else if (scheduledForToday) {
        invariant(scheduled)
        if (isDateISO(scheduled) || scheduled < startISO) {
          blocksByTime[startDate].tasks.push(task)
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
      if (isDateISO(event.startISO)) blocksByTime[startDate].events.push(event)
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

    return [blocksByTime, deadlines]
  }, shallow)

  const blocks = _.map(_.sortBy(_.entries(blocksByTime), 0), 1)

  const viewMode = useAppStore((state) => state.viewMode)
  const calendarMode = viewMode === 'week'

  let title =
    dragContainer === 'timer'
      ? 'Now'
      : DateTime.fromISO(startISO || endISO).toFormat(
          calendarMode ? 'EEE d' : 'EEE, MMM d'
        )

  const [expanded, setExpanded] = useState(
    dragContainer === 'timer' && !calendarMode ? false : true
  )
  useEffect(() => {
    if (calendarMode) setExpanded(true)
  }, [calendarMode])

  const foundTaskInAllDay = useAppStore((state) => {
    return state.findingTask &&
      blocks[0].tasks.find((task) => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && !expanded) {
      setExpanded(true)
      const foundTask = blocks[0].tasks.find(
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
  useLayoutEffect(() => {
    const resizeHeight = () => {
      if (!expanded || viewMode !== 'day') return
      const frame = allDayFrame.current
      if (!frame) return

      const parentFrame = frame.parentElement
      invariant(parentFrame)
      const parentHeight = parentFrame.getBoundingClientRect().height
      const frameHeight = frame.getBoundingClientRect().height
      if (frameHeight === parentHeight) {
        setTimeout(resizeHeight)
        return
      }
      if (frameHeight > parentHeight / 2 && frameHeight !== parentHeight) {
        setAllDayHeight('50%')
      }
    }
    resizeHeight()
  }, [calendarMode])

  const wide = useAppStore((state) => state.childWidth > 1)

  return (
    <div className={`flex flex-col overflow-hidden relative`}>
      <div className='flex items-center group relative z-10 pl-indent'>
        <Droppable
          data={{ scheduled: startDate }}
          id={dragContainer + '::' + startISO + '::timeline'}
        >
          <div className='flex items-center grow'>
            <div className='font-menu w-full'>{title || ''}</div>
            <Button
              className='w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
              src={expanded ? 'chevron-down' : 'chevron-left'}
              onClick={() => {
                setExpanded(!expanded)
                return false
              }}
            />
          </div>
        </Droppable>
      </div>

      <div
        className={`rounded-lg ${
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
        {deadlines.length + blocks[0].tasks.length + blocks[0].events.length >
          0 && (
          <div
            className={`relative w-full child:mb-1 overflow-x-hidden rounded-lg mt-1 ${
              {
                hour: wide
                  ? '!h-full'
                  : 'max-h-[50%] flex-none overflow-y-auto resize-y',
                day: 'h-fit',
                week: 'h-fit',
              }[viewMode]
            } ${!expanded ? 'hidden' : 'block'}`}
            style={{
              height: viewMode === 'hour' ? allDayHeight : '',
            }}
            data-auto-scroll={calendarMode ? undefined : 'y'}
            ref={allDayFrame}
          >
            {deadlines.length > 0 && (
              <div className='rounded-lg bg-secondary-alt'>
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
            {blocks[0].events.map((event) => (
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
            {blocks[0].tasks.length > 0 && (
              <Block
                type='event'
                events={[]}
                tasks={blocks[0].tasks}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer}
                blocks={[]}
              />
            )}
          </div>
        )}

        <div
          className={`overflow-x-hidden rounded-lg mt-1 ${
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
              blocks: blocks.slice(1),
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
