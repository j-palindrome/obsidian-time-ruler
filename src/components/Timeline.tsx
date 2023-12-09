import { useDraggable, useDroppable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import {
  isDateISO,
  parseTaskDate,
  removeNestedChildren,
  roundMinutes,
  toISO,
  useCollapsed,
  useHourDisplay,
} from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Task from './Task'
import TimeSpan from './TimeSpan'
import { TimeSpanTypes } from './Times'

export default function Timeline({
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
  const events = useAppStore((state) => {
    return _.filter(
      state.events,
      (event) =>
        event.endISO > startISO &&
        event.startISO < endISO &&
        (showingPastDates ? event.startISO <= now : event.endISO >= now)
    )
  }, shallow)

  const startDate = startISO.slice(0, 10)
  const isToday = startDate === DateTime.now().toISODate()
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const [tasks, dueTasks, allDayTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    const allDayTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const isShown = !task.completed || showingPastDates || showCompleted
      if (!isShown) return
      // for viewing past tasks correctly
      const scheduled = parseTaskDate(task)

      const scheduledForToday = !scheduled
        ? false
        : isDateISO(scheduled)
        ? scheduled === startDate ||
          (isToday && !showingPastDates && scheduled < startDate)
        : ((isToday && !showingPastDates) || scheduled >= startISO) &&
          scheduled < endISO

      const dueToday = !task.due
        ? false
        : scheduled &&
          (isDateISO(scheduled) ? scheduled > startDate : scheduled >= endISO)
        ? false
        : isDateISO(task.due)
        ? task.due >= startDate ||
          (isToday && !showingPastDates && task.due < startDate)
        : task.due >= startISO && task.due < endISO

      if (!scheduledForToday && dueToday) {
        dueTasks.push(task)
      } else if (scheduledForToday) {
        invariant(scheduled)
        if (isDateISO(scheduled) || scheduled < startISO) {
          allDayTasks.push(task)
        } else {
          tasks.push(task)
        }
      }
    })

    const scheduledParents = tasks.map((task) => task.id)
    for (let id of scheduledParents) {
      removeNestedChildren(id, allDayTasks)
    }

    return [tasks, dueTasks, allDayTasks]
  }, shallow)

  const allDayEvents: EventProps[] = []
  const atTimeEvents: EventProps[] = []
  for (let event of events) {
    if (isDateISO(event.startISO)) allDayEvents.push(event)
    else atTimeEvents.push(event)
  }

  const allTimeObjects = (tasks as (TaskProps | EventProps)[]).concat(
    atTimeEvents
  )
  const blocks = _.groupBy(allTimeObjects, (object) =>
    object.type === 'event'
      ? object.startISO
      : (parseTaskDate(object) as string)
  )
  const sortedBlocks = _.sortBy(_.entries(blocks), 0)
  if (isToday) console.log(sortedBlocks)

  const timeBlocks = sortedBlocks.filter(([time, _tasks]) => !isDateISO(time))

  const viewMode = useAppStore((state) => state.viewMode)
  const calendarMode = viewMode === 'week'

  let title =
    dragContainer === 'timer'
      ? 'Now'
      : DateTime.fromISO(startISO || endISO).toFormat(
          calendarMode ? 'EEE d' : 'EEE, MMM d'
        )

  const timeSpan = (
    <TimeSpan
      {...{
        startISO,
        endISO,
        type,
        blocks: timeBlocks,
        dragContainer,
      }}
      startWithHours={!isToday || showingPastDates}
    />
  )

  const [expanded, setExpanded] = useState(
    dragContainer === 'timer' && !calendarMode ? false : true
  )
  useEffect(() => {
    if (calendarMode) setExpanded(true)
  }, [calendarMode])

  const foundTaskInAllDay = useAppStore((state) => {
    return state.findingTask &&
      allDayTasks.find((task) => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && !expanded) {
      setExpanded(true)
      const foundTask = allDayTasks.find(
        (task) => task.id === foundTaskInAllDay
      ) as TaskProps
      if (!foundTask) return
      setters.set({ findingTask: null })
      setTimeout(() =>
        openTaskInRuler(foundTask.position.start.line, foundTask.path)
      )
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

  const { collapsed, allHeadings } = useCollapsed(tasks.concat(allDayTasks))

  const wide = useAppStore((state) => state.childWidth > 1)

  return (
    <div className={`flex flex-col overflow-hidden relative`}>
      <div className='flex items-center space-x-1 group relative z-10'>
        <Button
          className='w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
          onClick={() => setters.patchCollapsed(allHeadings, !collapsed)}
          src={collapsed ? 'chevron-right' : 'chevron-down'}
        />

        <Droppable
          data={{ scheduled: startDate }}
          id={dragContainer + '::' + startISO + '::timeline'}
        >
          <div className='flex pl-2 items-center grow'>
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
        {dueTasks.length + allDayEvents.length + allDayTasks.length > 0 && (
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
            {dueTasks.length > 0 && (
              <div className='rounded-lg bg-secondary-alt'>
                {_.sortBy(dueTasks, 'due', 'scheduled').map((task) => (
                  <Task
                    key={task.id}
                    id={task.id}
                    type='deadline'
                    dragContainer={dragContainer}
                  />
                ))}
              </div>
            )}
            {allDayEvents.map((event) => (
              <Event
                key={event.id}
                id={event.id}
                tasks={[]}
                blocks={[]}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer}
                noExtension
              />
            ))}
            {allDayTasks.length > 0 && (
              <Event
                tasks={allDayTasks}
                blocks={[]}
                startISO={startDate}
                endISO={startDate}
                dragContainer={dragContainer}
                noExtension
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
          {timeSpan}
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
