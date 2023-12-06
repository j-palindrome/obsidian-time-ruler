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
  hideTimes = false,
  dragContainer = '',
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  hideTimes?: boolean
  dragContainer?: string
}) {
  const showingPastDates = useAppStore((state) => state.showingPastDates)

  dragContainer = dragContainer || startISO
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

  const isToday =
    startISO.slice(0, 10) === (DateTime.now().toISODate() as string)
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const [tasks, dueTasks, allDayTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    const allDayTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const isShown = !task.completed || showingPastDates || showCompleted
      if (!isShown) return
      // for viewing past tasks correctly
      const scheduledDate = parseTaskDate(task)

      const scheduledForToday =
        scheduledDate &&
        scheduledDate < endISO &&
        ((isToday && !showingPastDates) || scheduledDate >= startISO) &&
        !(
          !task.completed &&
          isToday &&
          showingPastDates &&
          task.scheduled === startISO
        )
      const dueToday =
        task.due &&
        task.due < endISO &&
        (task.due >= startISO || (isToday && !showingPastDates))
      if (!scheduledForToday && dueToday) {
        dueTasks.push(task)
      } else if (scheduledForToday) {
        invariant(scheduledDate)
        if (scheduledDate > startISO) {
          tasks.push(task)
        } else {
          allDayTasks.push(task)
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
    object.type === 'event' ? object.startISO : parseTaskDate(object)
  )
  const sortedBlocks = _.sortBy(_.entries(blocks), 0)
  const timeBlocks = sortedBlocks.filter(([time, _tasks]) => time > startISO)

  const calendarMode = useAppStore((state) => state.calendarMode)
  let title =
    dragContainer === 'timer'
      ? 'Now'
      : DateTime.fromISO(startISO || endISO).toFormat(
          calendarMode ? 'EEE d' : 'EEE, MMM d'
        )

  const hidingTimes = hideTimes || calendarMode

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
      hideTimes={hidingTimes}
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
      if (!expanded || calendarMode) return
      const frame = allDayFrame.current
      invariant(frame)

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

  return (
    <div
      className={`flex w-full flex-col ${
        calendarMode ? 'max-h-full' : 'h-full'
      }`}
    >
      <div className='flex items-center space-x-1 group'>
        <Button
          className='w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
          onClick={() => setters.patchCollapsed(allHeadings, !collapsed)}
          src={collapsed ? 'chevron-right' : 'chevron-down'}
        />

        <Droppable
          data={{ scheduled: startISO }}
          id={dragContainer + startISO + '::timeline'}
        >
          <div className='flex items-center space-x-1 grow'>
            <div className='font-menu'>{title || ''}</div>
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
        className={`space-y-2 rounded-lg ${
          calendarMode ? 'overflow-y-auto' : 'h-0 grow flex flex-col'
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        <div
          className={`relative w-full space-y-2 overflow-x-hidden rounded-lg ${
            calendarMode
              ? 'h-fit'
              : // @ts-ignore
                `${
                  app.isMobile ? 'max-h-[40%]' : 'max-h-[80%]'
                } flex-none overflow-y-auto`
          } ${!expanded ? 'hidden' : 'block'}`}
          style={{
            resize: !calendarMode ? 'vertical' : 'none',
            height: allDayHeight,
          }}
          data-auto-scroll={calendarMode ? undefined : 'y'}
          ref={allDayFrame}
        >
          <div>
            {_.sortBy(dueTasks, 'due', 'scheduled').map((task) => (
              <Task
                key={task.id}
                id={task.id}
                type='deadline'
                dragContainer={dragContainer}
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
              endISO={startISO}
              dragContainer={dragContainer}
              noExtension
            />
          ))}
          {allDayTasks.length > 0 && (
            <Event
              tasks={allDayTasks}
              blocks={[]}
              startISO={startISO}
              endISO={startISO}
              dragContainer={dragContainer}
              noExtension
            />
          )}
        </div>

        <div
          className={`flex w-full flex-col overflow-x-hidden rounded-lg ${
            calendarMode ? 'h-fit' : 'h-0 grow overflow-y-auto'
          }`}
          data-auto-scroll={calendarMode ? undefined : 'y'}
        >
          {isToday && !calendarMode && !showingPastDates && (
            <NowTime dragContainer={dragContainer} />
          )}
          {timeSpan}
          {isToday && !calendarMode && showingPastDates && (
            <NowTime dragContainer={dragContainer} />
          )}
          <Droppable
            data={{ scheduled: startISO }}
            id={`${dragContainer}::timeline::end`}
          >
            <div className='h-0 grow'></div>
          </Droppable>
        </div>
      </div>
    </div>
  )
}

export function NowTime({ dragContainer }: { dragContainer?: string }) {
  const startISO = toISO(roundMinutes(DateTime.now()))
  const { isOver, setNodeRef } = useDroppable({
    id: dragContainer + '::' + startISO + '::scheduled::now',
    data: { scheduled: startISO } as DropData,
  })

  const dragData: DragData = {
    dragType: 'now',
  }
  const {
    setNodeRef: setDragNodeRef,
    attributes,
    listeners,
  } = useDraggable({
    data: dragData,
    id: `${dragContainer}::now`,
  })

  const nowTime = roundMinutes(DateTime.now())
  const hourDisplay = useHourDisplay(nowTime.hour)

  return (
    <div
      className={`py-2 flex w-full items-center rounded-lg pl-9 pr-2 cursor-grab hover:bg-selection transition-colors duration-300 ${
        isOver ? 'bg-selection' : ''
      }`}
      {...attributes}
      {...listeners}
      ref={(node) => {
        setNodeRef(node)
        setDragNodeRef(node)
      }}
    >
      <div className='w-full border-0 border-b border-solid border-red-800'></div>
      <div className='h-1 w-1 rounded-full bg-red-800'></div>
      <div className='text-xs font-menu ml-2'>{`${hourDisplay}:${String(
        nowTime.minute
      ).padStart(2, '0')}`}</div>
    </div>
  )
}
