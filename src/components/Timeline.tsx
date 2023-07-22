import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState } from 'react'
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
  includePast,
  due,
}: {
  includePast?: boolean
  startISO: string
  endISO: string
  type: TimeSpanTypes
  due?: boolean
}) {
  const now = DateTime.now().toISO() as string
  const events = useAppStore((state) => {
    return due
      ? []
      : _.filter(
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
    return due
      ? tasks
      : tasks.filter(
          (task) =>
            !(
              task.parent &&
              tasksMap[task.parent] &&
              task.scheduled &&
              isDateISO(task.scheduled)
            )
        )
  }
  const [tasks, dueTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      if (
        (!task.scheduled || task.scheduled <= startISO) &&
        task.due &&
        task.due >= startISO
      ) {
        dueTasks.push(task)
      } else if (
        task.scheduled &&
        task.scheduled >= startISO &&
        task.scheduled < endISO
      ) {
        tasks.push(task)
      }
    })
    return [filterAllDayChildren(tasks), dueTasks]
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
      : due
      ? object.due
      : object.scheduled
  )
  const sortedBlocks = _.sortBy(_.entries(blocks), 0)
  const allDayTasks = sortedBlocks.filter(
    ([time, _tasks]) => time <= startISO
  ) as [string, TaskProps[]][]
  const atTimeBlocks = sortedBlocks.filter(([time, _tasks]) => time > startISO)

  const title = due
    ? 'Upcoming'
    : DateTime.fromISO(startISO || endISO).toFormat(
        type === 'days' ? 'MMMM' : 'EEE, MMM d'
      )

  const calendarMode = useAppStore((state) => state.calendarMode)

  const timeSpan = (
    <TimeSpan
      {...{ startISO, endISO, type, blocks: atTimeBlocks, due }}
      startWithHours={startISO !== DateTime.now().toISODate()}
    />
  )

  return (
    <div className='flex h-full flex-col'>
      <Droppable
        data={{ scheduled: startISO }}
        id={startISO + '::timeline' + (due ? '::due' : '')}
      >
        <div className='group flex w-full flex-none items-center'>
          <Button
            src='plus'
            className='ml-2 mr-1 h-4 w-4 flex-none opacity-0 transition-opacity duration-300 group-hover:opacity-100'
            onClick={() => {
              setters.set({ searchStatus: { scheduled: startISO } })
            }}
          />
          <div className='w-full rounded-lg px-1'>{title || ''}</div>
        </div>
      </Droppable>
      <div
        className={`h-0 grow space-y-2 ${
          calendarMode ? 'overflow-y-auto' : 'flex flex-col'
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        <div
          className={`relative mt-2 w-full overflow-y-auto overflow-x-hidden rounded-lg ${
            calendarMode ? '' : 'max-h-[50%] flex-none'
          }`}
          data-auto-scroll={calendarMode ? undefined : 'y'}
        >
          {_.sortBy(dueTasks, 'due', 'scheduled').map((task) => (
            <Task
              id={task.id}
              due
              type={
                (task.due as string) >= startISO &&
                (task.due as string) <= endISO
                  ? 'task'
                  : 'link'
              }
            />
          ))}
          {allDayEvents.map((event) => (
            <Event
              key={event.id}
              id={event.id}
              tasks={[]}
              blocks={[]}
              startISO={startISO}
              endISO={event.startISO}
              displayStartISO={event.startISO}
            />
          ))}
          {allDayTasks.map(([time, tasks]) => (
            <Event
              key={time}
              tasks={tasks}
              blocks={[]}
              due={due}
              startISO={startISO}
              endISO={time}
              displayStartISO={time}
            />
          ))}
        </div>

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
