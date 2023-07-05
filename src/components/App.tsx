import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringConfiguration,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import $ from 'jquery'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'
import useStateRef from 'react-usestateref'
import { shallow } from 'zustand/shallow'
import {
  AppState,
  getters,
  setters,
  useAppStore,
  useAppStoreRef
} from '../app/store'
import { useAutoScroll } from '../services/autoScroll'
import { TaskActions } from '../types/enums'
import Block, { Group, Heading } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Search from './Search'
import Task from './Task'
import Timeline from './Timeline'
import { Timer } from './Timer'
import { TimeSpanTypes } from './Times'

const START_BUTTONS = 2

/**
 * @param apis: We need to store these APIs within the store in order to hold their references to call from the store itself, which is why we do things like this.
 */
export default function App({ apis }: { apis: AppState['apis'] }) {
  useEffect(() => setters.set({ apis }), [apis])

  const [now, setNow] = useState(DateTime.now())
  useEffect(() => {
    const update = () => {
      setNow(DateTime.now())
    }
    const FIFTEEN_MINUTES = 1000 * 60 * 15
    const interval = window.setInterval(update, 60000)
    return () => window.clearInterval(interval)
  }, [])

  const today = now.startOf('day')
  const [datesShownState, setDatesShown] = useState(7)
  const nextMonday = DateTime.now()
    .plus({ days: datesShownState })
    .startOf('week')
  const datesShown = _.round(nextMonday.diff(DateTime.now()).as('days'))

  const times: Parameters<typeof Timeline>[0][] = [
    {
      startISO: today.toISODate() as string,
      endISO: today.plus({ days: 1 }).toISODate() as string,
      type: 'minutes',
      includePast: true
    },
    ..._.range(1, datesShown).map(i => ({
      startISO: today.plus({ days: i }).toISODate() as string,
      endISO: today.plus({ days: i + 1 }).toISODate() as string,
      type: 'minutes' as TimeSpanTypes
    }))
  ]

  const [activeDrag, activeDragRef] = useAppStoreRef(state => state.dragData)

  useAutoScroll(!!activeDrag)

  const onDragEnd = (ev: DragEndEvent) => {
    const dropData = ev.over?.data.current as DropData | undefined
    const dragData = activeDragRef.current

    if (dropData && dragData) {
      if (dragData.dragType === 'time') {
        if (!dropData.scheduled) return
        const { hours, minutes } = DateTime.fromISO(dropData.scheduled)
          .diff(DateTime.fromISO(dragData.start))
          .shiftTo('hours', 'minutes')
          .toObject() as { hours: number; minutes: number }
        setters.set({
          searchStatus: {
            scheduled: dragData.start,
            length: { hour: hours, minute: minutes }
          }
        })
      } else if (dragData.dragType === 'new') {
        const [path, heading] = dragData.path.split('#')
        getters.getObsidianAPI().createTask(path + '.md', heading, dropData)
      } else if (dragData.dragType === 'task-length') {
        if (!dropData.scheduled) return
        const start = DateTime.fromISO(dragData.start)
        const end = DateTime.fromISO(dropData.scheduled)
        const length = end.diff(start).shiftTo('hours', 'minutes')

        if (length.hours + length.minutes < 0) return
        const taskLength = {
          hour: length.hours ?? 0,
          minute: length.minutes ?? 0
        }

        setters.patchTasks([dragData.id], {
          length: taskLength
        })
      } else {
        setters.patchTasks(
          dragData.dragType === 'group' || dragData.dragType === 'event'
            ? dragData.tasks.flatMap(x =>
                x.type === 'parent' ? x.children : x.id
              )
            : dragData.dragType === 'task'
            ? [dragData.id]
            : [],
          dropData
        )
      }
    }

    setters.set({ dragData: null })
  }

  const onDragStart = (ev: DragStartEvent) => {
    setters.set({ dragData: ev.active.data.current as DragData })
  }

  const measuringConfig: MeasuringConfiguration = {
    draggable: {
      measure: el => {
        const parentRect = (
          $('#time-ruler').parent()[0] as HTMLDivElement
        ).getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        return {
          ...rect,
          left: rect.left - parentRect.left,
          top: rect.top - parentRect.top
        }
      }
    },
    dragOverlay: {
      measure: el => {
        const parentRect = (
          $('#time-ruler').parent()[0] as HTMLDivElement
        ).getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        return {
          ...rect,
          left: rect.left - parentRect.left,
          top: rect.top - parentRect.top
        }
      }
    }
  }

  const getDragElement = () => {
    if (!activeDrag) return <></>
    switch (activeDrag.dragType) {
      case 'task':
        return <Task {...activeDrag} />
      case 'task-length':
        return <div className='h-0.5 w-full cursor-ns-resize bg-faint'></div>
      case 'group':
        return <Group {...activeDrag} />
      case 'event':
        return <Event {...activeDrag} draggable={false} />
      case 'new':
        return <Heading {...activeDrag} />
    }
  }

  const [childWidth, setChildWidth, childWidthRef] = useStateRef('child:w-full')

  useEffect(() => {
    const timeRuler = document.querySelector('#time-ruler') as HTMLElement
    function outputSize() {
      const width = timeRuler.clientWidth
      const newChildWidth =
        width < 500
          ? 'child:w-full'
          : width < 800
          ? 'child:w-1/2'
          : width < 1200
          ? 'child:w-1/3'
          : 'child:w-1/4'
      if (newChildWidth !== childWidthRef.current) setChildWidth(newChildWidth)
    }
    outputSize()

    const observer = new ResizeObserver(outputSize)
    observer.observe(timeRuler)
    return () => observer.disconnect()
  }, [])

  const sensors = useSensors(
    ...(app['isMobile']
      ? [
          useSensor(TouchSensor, {
            activationConstraint: {
              delay: 250,
              tolerance: 5
            }
          })
        ]
      : [useSensor(PointerSensor), useSensor(MouseSensor)])
  )

  const scrollToNow = () => {
    setTimeout(
      () =>
        $('#time-ruler-times').children()[START_BUTTONS]?.scrollIntoView({
          inline: 'start',
          behavior: 'smooth'
        }),
      250
    )
  }

  useEffect(() => {
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('overflow', 'clip', 'important')
  }, [])

  useEffect(scrollToNow, [])

  const calendarMode = useAppStore(state => state.calendarMode)

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setters.set({ dragData: null })}
      collisionDetection={pointerWithin}
      measuring={measuringConfig}
      sensors={sensors}
      autoScroll={false}>
      <div
        id='time-ruler'
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent'
        }}>
        <DragOverlay dropAnimation={null}>{getDragElement()}</DragOverlay>
        <Buttons {...{ times, datesShown, setDatesShown }} />
        <Timer />
        <div
          className={`h-full w-full rounded-lg bg-primary-alt text-base child:space-y-2 child:overflow-clip child:p-2 ${
            calendarMode
              ? 'overflow-y-auto child:w-full'
              : `flex snap-x snap-mandatory !overflow-x-auto overflow-y-clip child:flex child:h-full child:flex-none child:snap-start child:flex-col ${childWidth}`
          }`}
          id='time-ruler-times'
          data-auto-scroll={calendarMode ? 'y' : 'x'}>
          <Unscheduled />
          <Timeline
            startISO={now.toISODate() as string}
            endISO={now.plus({ months: 4 }).toISODate() as string}
            type='days'
            includePast
            due
          />
          {times.map((time, i) => (
            <Timeline
              key={time.startISO + '::' + time.type + '::' + time.due}
              {...time}
            />
          ))}
          <Button
            className={`force-hover rounded-lg ${calendarMode ? '' : '!w-8'}`}
            onClick={() => setDatesShown(datesShown + 7)}
            src='chevron-right'
          />
        </div>
      </div>
    </DndContext>
  )
}

const Buttons = ({ times, datesShown, setDatesShown }) => {
  const now = DateTime.now()

  const scrollToSection = (section: number) => {
    $('#time-ruler-times').children()[section]?.scrollIntoView({
      block: 'start',
      behavior: 'smooth'
    })
  }

  const calendarMode = useAppStore(state => state.calendarMode)
  const otherButtons = (
    <>
      <Droppable
        id='unscheduled::button'
        data={{ scheduled: TaskActions.DELETE }}>
        <Button onClick={() => scrollToSection(0)} data-section-scroll={0}>
          Unscheduled
        </Button>
      </Droppable>
      <Droppable
        id='upcoming::button'
        data={{ due: now.toISODate() as string }}>
        <Button onClick={() => scrollToSection(1)} data-section-scroll={1}>
          Upcoming
        </Button>
      </Droppable>
    </>
  )

  const nextButton = (
    <Button
      onClick={() => setDatesShown(datesShown + 7)}
      src={'chevron-right'}
    />
  )

  const dayPadding = () => {
    return _.range(1, now.weekday).map(i => <div key={i}></div>)
  }

  return (
    <>
      <div
        className={`w-full ${
          calendarMode ? 'space-y-1' : 'flex items-center space-x-1'
        }`}
        data-auto-scroll={calendarMode ? '' : 'x'}>
        <div
          className={`flex items-center space-x-2 ${
            calendarMode ? 'w-full overflow-x-auto' : ''
          }`}>
          <Search />

          <Button
            title='reload'
            onClick={() => {
              getters.getCalendarAPI().loadEvents()
              getters.getObsidianAPI().loadTasks()
            }}
            src={'rotate-cw'}
          />

          <Button
            title='toggle day view'
            onClick={() => {
              setters.set({
                calendarMode: !calendarMode
              })
            }}
            src={calendarMode ? 'calendar-days' : 'calendar'}></Button>

          {calendarMode && otherButtons}
          {calendarMode && nextButton}
        </div>
        <div
          className={`no-scrollbar flex w-full rounded-icon pb-0.5 ${
            calendarMode
              ? 'max-h-[calc(28px*4+2px)] flex-wrap justify-around overflow-y-auto child:w-[calc(100%/7)]'
              : 'items-center space-x-2 overflow-x-auto '
          }`}
          data-auto-scroll={calendarMode ? '' : 'x'}>
          {!calendarMode && otherButtons}
          {calendarMode && dayPadding()}
          {times.map((times, i) => {
            const thisDate = DateTime.fromISO(times.startISO)
            return (
              <Droppable
                key={times.startISO}
                id={times.startISO + '::button'}
                data={{ scheduled: times.startISO }}>
                <Button
                  className='h-[28px]'
                  onClick={() => scrollToSection(i + START_BUTTONS)}
                  data-section-scroll={i + START_BUTTONS}>
                  {thisDate.toFormat(
                    calendarMode
                      ? thisDate.day === 1 || i === 0
                        ? 'MMM d'
                        : 'd'
                      : 'EEE MMM d'
                  )}
                </Button>
              </Droppable>
            )
          })}

          {!calendarMode && nextButton}
        </div>
      </div>
    </>
  )
}

function Unscheduled() {
  const unscheduled = useAppStore(
    state => _.filter(state.tasks, task => !task.scheduled && !task.parent),
    shallow
  )

  return (
    <div>
      <div className='mb-1 rounded px-2'>Unscheduled</div>
      <div className='h-full overflow-y-auto rounded-lg bg-primary-alt'>
        <Block tasks={unscheduled} type='time' scheduled={null} />
      </div>
    </div>
  )
}
