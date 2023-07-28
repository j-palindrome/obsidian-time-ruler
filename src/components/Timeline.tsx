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

export default function Timeline({
  startISO,
  endISO,
  type,
}: {
  includePast?: boolean
  startISO: string
  endISO: string
  type: TimeSpanTypes
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

  const filterAllDayChildren = (tasks: TaskProps[]) => {
    const tasksMap = _.fromPairs(tasks.map((task) => [task.id, task]))
    return tasks.filter(
      (task) =>
        !(
          task.parent &&
          tasksMap[task.parent] &&
          task.scheduled &&
          isDateISO(task.scheduled)
        )
    )
  }

  const isToday =
    startISO.slice(0, 10) === (DateTime.now().toISODate() as string)

  const [tasks, dueTasks, allDayTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    const allDayTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      if (
        (!task.scheduled || task.scheduled < startISO) &&
        task.due &&
        (task.due >= startISO || (isToday && task.due < endISO))
      ) {
        dueTasks.push(task)
      } else if (task.scheduled && task.scheduled < endISO) {
        if (task.scheduled > startISO) {
          tasks.push(task)
        } else if (
          task.scheduled === startISO ||
          (isToday && task.scheduled <= startISO)
        ) {
          allDayTasks.push(task)
        }
      }
    })
    return [filterAllDayChildren(tasks), dueTasks, allDayTasks]
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

  const timeSpan = (
    <TimeSpan
      {...{ startISO, endISO, type, blocks: timeBlocks }}
      startWithHours={startISO !== DateTime.now().toISODate()}
    />
  )

  const [expanded, setExpanded] = useState(true)
  const isExpanded = calendarMode || expanded

  const foundTaskInAllDay = useAppStore((state) => {
    return state.findingTask &&
      allDayTasks.find((task) => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && !isExpanded) {
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
          {!calendarMode && (
            <Button
              className='aspect-square h-full'
              onClick={() => setExpanded(!isExpanded)}
              src={isExpanded ? 'chevron-up' : 'chevron-down'}
            />
          )}
        </div>
      </Droppable>
      <div
        className={`h-0 grow space-y-2 ${
          calendarMode ? 'overflow-y-auto' : 'flex flex-col'
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        {isExpanded && (
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
          className={`w-full overflow-x-hidden rounded-lg ${
            calendarMode ? '' : 'h-full overflow-y-auto'
          }`}
          data-auto-scroll={calendarMode ? undefined : 'y'}
        >
          {timeSpan}
        </div>
      </div>
    </div>
  )
}
