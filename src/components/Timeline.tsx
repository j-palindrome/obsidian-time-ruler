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

export default function Timeline({
  startISO,
  endISO,
  type,
  includePast,
  due
}: {
  includePast?: boolean
  startISO: string
  endISO: string
  type: TimeSpanTypes
  due?: boolean
}) {
  const now = DateTime.now().toISO() as string
  const events = useAppStore(state => {
    return due
      ? []
      : _.filter(
          state.events,
          event =>
            !(
              event.endISO <= startISO ||
              event.startISO >= endISO ||
              event.endISO <= now
            )
        )
  }, shallow)

  const filterAllDayChildren = (tasks: TaskProps[]) => {
    const tasksMap = _.fromPairs(tasks.map(task => [task.id, task]))
    return due
      ? tasks
      : tasks.filter(
          task =>
            !(
              task.parent &&
              tasksMap[task.parent] &&
              task.scheduled &&
              isDateISO(task.scheduled)
            )
        )
  }
  const tasks = useAppStore(state => {
    return filterAllDayChildren(
      _.filter(state.tasks, task => {
        const key = due ? task.due : task.scheduled
        return (
          !!key && (includePast || key >= startISO) && (due || key < endISO)
        )
      })
    )
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

  const blocks = _.groupBy(allTimeObjects, object =>
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

  const [expanded, setExpanded] = useState(true)

  const foundTaskInAllDay = useAppStore(state => {
    return state.findingTask &&
      _.flatMap(allDayTasks, '1').find(task => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && !expanded) {
      setExpanded(true)
      const foundTask = allDayTasks
        .map(([_name, tasks]) => tasks)
        .flat()
        .find(task => task.id === foundTaskInAllDay) as TaskProps
      if (!foundTask) return
      setters.set({ findingTask: null })
      setTimeout(() =>
        openTaskInRuler(foundTask.position.start.line, foundTask.path)
      )
    }
  }
  useEffect(expandIfFound, [foundTaskInAllDay])

  return (
    <div className='h-full'>
      <Droppable data={{ scheduled: startISO }} id={startISO + '::timeline'}>
        <div className='flex-none rounded-lg px-1'>{title || ''}</div>
      </Droppable>
      {allDayTasks.length > 0 && (
        <>
          {expanded && (
            <div
              className='relative mt-2 max-h-[66%] w-full flex-none space-y-2 overflow-y-auto overflow-x-hidden rounded-lg'
              data-auto-scroll='y'>
              {allDayEvents.map(event => (
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
          )}
          <Button
            className='selectable flex h-4 w-full items-center justify-center p-0'
            onClick={() => setExpanded(!expanded)}
            src={expanded ? 'chevron-up' : 'chevron-down'}
          />
        </>
      )}
      <div
        className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg'
        data-auto-scroll='y'>
        <TimeSpan
          {...{ startISO, endISO, type, blocks: atTimeBlocks, due }}
          startWithHours={startISO !== DateTime.now().toISODate()}
        />
      </div>
    </div>
  )
}
