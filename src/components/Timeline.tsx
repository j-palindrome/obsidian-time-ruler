import _, { isDate } from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState } from 'react'
import { setters, useAppStore } from '../app/store'
import { isDateISO } from '../services/util'
import { shallow } from 'zustand/shallow'
import Block from './Block'
import Droppable from './Droppable'
import Event from './Event'
import Times, { TimeSpanTypes } from './Times'
import { openTaskInRuler } from '../services/obsidianApi'
import Logo from './Logo'
import Button from './Button'

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
              event.end <= startISO ||
              event.start >= endISO ||
              event.end <= now
            )
        )
  }, shallow)

  const filterAllDayChildren = (tasks: TaskProps[]) => {
    const tasksMap = _.fromPairs(tasks.map(task => [task.id, task]))
    return tasks.filter(
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
    if (isDateISO(event.start)) allDayEvents.push(event)
    else atTimeEvents.push(event)
  }

  const allTimeObjects = (tasks as (TaskProps | EventProps)[]).concat(
    atTimeEvents
  )

  console.log(allTimeObjects)

  const blocks = _.groupBy(allTimeObjects, object =>
    object.type === 'event' ? object.start : due ? object.due : object.scheduled
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
  let maxTime = startISO

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

  const hasHoursStarting = type === 'minutes' && startISO > now

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
                  start={startISO}
                  end={event.start}
                  displayStart={event.start}
                />
              ))}
              {allDayTasks.map(([time, tasks]) => (
                <Event
                  key={time}
                  tasks={tasks}
                  due={due}
                  start={startISO}
                  end={time}
                  displayStart={time}
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
        <Times
          type={hasHoursStarting ? 'hours' : type}
          startISO={startISO}
          endISO={atTimeBlocks[0]?.[0] ?? endISO}
          chopEnd
          due={due}
        />

        {atTimeBlocks.map(([time, items], i) => {
          const thisEvent = items.find(item => item.type === 'event') as
            | EventProps
            | undefined
          const tasksWithLength = items.filter(
            item => item.type !== 'event' && item.length
          ) as (TaskProps & { length: NonNullable<TaskProps['length']> })[]
          const totalLength = tasksWithLength.reduce(
            ({ hour, minute }, task) => ({
              hour: hour + task.length.hour,
              minute: minute + task.length.minute
            }),
            { hour: 0, minute: 0 }
          )
          const hasLength =
            thisEvent || totalLength.hour + totalLength.minute > 0

          const tasks = items.filter(
            item => item.type !== 'event'
          ) as TaskProps[]

          let endTime = ['days'].includes(type)
            ? time
            : thisEvent
            ? thisEvent.end
            : hasLength
            ? (DateTime.fromISO(time)
                .plus({
                  hours: totalLength.hour,
                  minutes: totalLength.minute
                })
                .toISO() as string)
            : time
          const displayStart = time
          if (time < maxTime) time = maxTime
          if (endTime < maxTime) endTime = maxTime
          if (endTime > maxTime) maxTime = endTime
          return (
            <Fragment key={items.map(x => x.id).join('')}>
              {thisEvent ? (
                <Event
                  {...thisEvent}
                  tasks={tasks}
                  type={type}
                  due={due}
                  displayStart={displayStart}
                />
              ) : (
                <Event
                  start={time}
                  end={endTime}
                  tasks={tasks}
                  type={type}
                  due={due}
                  displayStart={displayStart}
                />
              )}

              <Times
                type={type}
                startISO={maxTime}
                endISO={atTimeBlocks[i + 1]?.[0] ?? endISO}
                chopEnd
                chopStart={!hasLength}
                due={due}
              />
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
