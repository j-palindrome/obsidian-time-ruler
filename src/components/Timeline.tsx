import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState, useMemo } from 'react'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import { isDateISO } from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Times, { TimeSpanTypes } from './Times'
import TimeSpan from './TimeSpan'
import Task from './Task'
import invariant from 'tiny-invariant'

export default function Timeline({
  startISO,
  endISO,
  type,
  hideTimes = false,
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  hideTimes?: boolean
}) {
  const now = DateTime.now().toISO() as string
  const events = useAppStore((state) => {
    return _.filter(
      state.events,
      (event) =>
        !(
          event.endISO <= startISO ||
          event.startISO >= endISO ||
          event.endISO <= now
        )
    )
  }, shallow)

  const isToday =
    startISO.slice(0, 10) === (DateTime.now().toISODate() as string)

  const [tasks, dueTasks, allDayTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    const allDayTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const scheduledForToday =
        !task.completion &&
        task.scheduled &&
        task.scheduled < endISO &&
        (isToday || task.scheduled >= startISO)
      if (
        !scheduledForToday &&
        task.due &&
        !task.completion &&
        (task.due >= startISO || (isToday && task.due < endISO))
      ) {
        dueTasks.push(task)
      } else if (scheduledForToday) {
        invariant(task.scheduled)
        if (task.scheduled > startISO) {
          tasks.push(task)
        } else {
          allDayTasks.push(task)
        }
      }
    })
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
    object.type === 'event' ? object.startISO : object.scheduled
  )
  const sortedBlocks = _.sortBy(_.entries(blocks), 0)
  const timeBlocks = sortedBlocks.filter(([time, _tasks]) => time > startISO)

  const title = DateTime.fromISO(startISO || endISO).toFormat(
    type === 'days' ? 'MMMM' : 'EEE, MMM d'
  )

  const calendarMode = useAppStore((state) => state.calendarMode)

  const hidingTimes = hideTimes || calendarMode

  const timeSpan = (
    <TimeSpan
      {...{ startISO, endISO, type, blocks: timeBlocks }}
      startWithHours={startISO !== DateTime.now().toISODate()}
      hideTimes={hidingTimes}
    />
  )

  const [expanded, setExpanded] = useState(true)

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

  return (
    <div className='flex h-full flex-col'>
      <Droppable data={{ scheduled: startISO }} id={startISO + '::timeline'}>
        <div className='group flex w-full flex-none items-center'>
          <Button
            src='plus'
            className='ml-2 mr-1 h-4 w-4 flex-none opacity-0 transition-opacity duration-300 group-hover:opacity-100'
            onClick={() => {
              setters.set({ searchStatus: { scheduled: startISO } })
            }}
          />
          <div className='w-full rounded-lg px-1'>{title || ''}</div>
          <Button
            className='aspect-square h-full'
            onClick={() => setExpanded(!expanded)}
            src={expanded ? 'chevron-up' : 'chevron-down'}
          />
        </div>
      </Droppable>
      <div
        className={`flex h-0 grow flex-col space-y-2 ${
          calendarMode ? 'overflow-y-auto' : ''
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        {expanded && (
          <div
            className={`relative mt-2 w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-lg ${
              calendarMode ? '' : 'max-h-[50%] flex-none'
            }`}
            data-auto-scroll={calendarMode ? undefined : 'y'}
          >
            <div>
              {_.sortBy(dueTasks, 'due', 'scheduled').map((task) => (
                <Task
                  key={task.id}
                  id={task.id}
                  type='deadline'
                  dragContainer={startISO}
                />
              ))}
            </div>
            {allDayEvents.map((event) => (
              <Event
                key={event.id}
                id={event.id}
                tasks={[]}
                blocks={[]}
                startISO={startISO}
                endISO={event.startISO}
              />
            ))}
            {allDayTasks.length > 0 && (
              <Event
                tasks={allDayTasks}
                blocks={[]}
                startISO={startISO}
                endISO={startISO}
              />
            )}
          </div>
        )}

        <div
          className={`flex h-0 w-full grow flex-col overflow-x-hidden rounded-lg ${
            calendarMode ? '' : 'overflow-y-auto'
          }`}
          data-auto-scroll={calendarMode ? undefined : 'y'}
        >
          {timeSpan}
          <Droppable
            data={{ scheduled: startISO }}
            id={startISO + '::timeline::end'}
          >
            <div className='h-0 grow'></div>
          </Droppable>
        </div>
      </div>
    </div>
  )
}
