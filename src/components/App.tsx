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
  useSensors,
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
  useAppStoreRef,
} from '../app/store'
import { useAutoScroll } from '../services/autoScroll'
import { TaskActions, isTaskProps } from '../types/enums'
import Block from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Search from './Search'
import Task from './Task'
import Timeline from './Timeline'
import { Timer } from './Timer'
import { TimeSpanTypes } from './Times'
import invariant from 'tiny-invariant'
import { Platform } from 'obsidian'
import { getDailyNoteInfo } from '../services/obsidianApi'
import Heading from './Heading'
import Group from './Group'

/**
 * @param apis: We need to store these APIs within the store in order to hold their references to call from the store itself, which is why we do things like this.
 */
export default function App({ apis }: { apis: Required<AppState['apis']> }) {
  const setupStore = async () => {
    const dailyNoteInfo = await getDailyNoteInfo()
    setters.set({ apis, ...dailyNoteInfo })
  }
  useEffect(() => {
    setupStore()
  }, [apis])

  const [now, setNow] = useState(DateTime.now())
  useEffect(() => {
    const update = () => {
      setNow(DateTime.now())
    }
    const interval = window.setInterval(update, 60000)
    return () => window.clearInterval(interval)
  }, [])

  const today = now.startOf('day')
  const [datesShownState, setDatesShown] = useState(7)
  const nextMonday = DateTime.now()
    .plus({ days: datesShownState })
    .endOf('week')
    .plus({ days: 1 })
  const datesShown = _.round(nextMonday.diff(DateTime.now()).as('days'))

  const times: Parameters<typeof Timeline>[0][] = [
    {
      startISO: today.toISODate() as string,
      endISO: today.plus({ days: 1 }).toISODate() as string,
      type: 'minutes',
    },
    ..._.range(1, datesShown).map((i) => ({
      startISO: today.plus({ days: i }).toISODate() as string,
      endISO: today.plus({ days: i + 1 }).toISODate() as string,
      type: 'minutes' as TimeSpanTypes,
    })),
  ]

  const [activeDrag, activeDragRef] = useAppStoreRef((state) => state.dragData)

  useAutoScroll(!!activeDrag)

  const onDragEnd = (ev: DragEndEvent) => {
    const dropData = ev.over?.data.current as DropData | undefined
    const dragData = activeDragRef.current

    if (dropData && dragData) {
      if (!isTaskProps(dropData)) {
        if (dropData.type === 'heading' && dragData.dragType === 'group') {
          setters.updateFileOrder(dragData.name, dropData.heading)
        }
      } else if (isTaskProps(dropData)) {
        if (dragData.dragType === 'time') {
          if (!dropData.scheduled) return
          const { hours, minutes } = DateTime.fromISO(dropData.scheduled)
            .diff(DateTime.fromISO(dragData.start))
            .shiftTo('hours', 'minutes')
            .toObject() as { hours: number; minutes: number }
          setters.set({
            searchStatus: {
              scheduled: dragData.start,
              length: { hour: hours, minute: minutes },
            },
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
            minute: length.minutes ?? 0,
          }

          setters.patchTasks([dragData.id], {
            length: taskLength,
          })
        } else {
          setters.patchTasks(
            dragData.dragType === 'group' || dragData.dragType === 'event'
              ? dragData.tasks.flatMap((x) =>
                  x.type === 'parent' ? x.children : x.id
                )
              : dragData.dragType === 'task'
              ? [dragData.id]
              : [],
            dropData
          )
        }
      }
    }

    setters.set({ dragData: null })
  }

  const onDragStart = (ev: DragStartEvent) => {
    setters.set({ dragData: ev.active.data.current as DragData })
  }

  const measuringConfig: MeasuringConfiguration = {
    draggable: {
      measure: (el) => {
        const parentRect = (
          $('#time-ruler').parent()[0] as HTMLDivElement
        ).getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        return {
          ...rect,
          left: rect.left - parentRect.left,
          top: rect.top - parentRect.top,
        }
      },
    },
    dragOverlay: {
      measure: (el) => {
        const parentRect = (
          $('#time-ruler').parent()[0] as HTMLDivElement
        ).getBoundingClientRect()
        const rect = el.getBoundingClientRect()
        return {
          ...rect,
          left: rect.left - parentRect.left,
          top: rect.top - parentRect.top,
        }
      },
    },
  }

  const getDragElement = () => {
    if (!activeDrag) return <></>
    console.log(activeDrag)

    switch (activeDrag.dragType) {
      case 'task':
        return <Task {...activeDrag} />
      case 'task-length':
        return <div className='h-0.5 w-full cursor-ns-resize bg-faint'></div>
      case 'group':
        return <Group {...activeDrag} />
      case 'event':
        return <Event {...activeDrag} isDragging={true} />
      case 'new':
        return <Heading {...activeDrag} />
    }
  }

  const [childWidth, setChildWidth, childWidthRef] = useStateRef('child:w-full')

  useEffect(() => {
    function outputSize() {
      if (Platform.isMobile) {
        return
      }
      const timeRuler = document.querySelector('#time-ruler') as HTMLElement
      if (!timeRuler) return
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

    if (Platform.isMobile) {
      setChildWidth('child:w-full')
      return
    }

    const timeRuler = document.querySelector('#time-ruler') as HTMLElement
    const observer = new ResizeObserver(outputSize)
    observer.observe(timeRuler)
    return () => observer.disconnect()
  }, [])

  const sensors = useSensors(
    ...(Platform.isMobile
      ? [
          useSensor(TouchSensor, {
            activationConstraint: {
              delay: 250,
              tolerance: 5,
            },
          }),
        ]
      : [useSensor(PointerSensor), useSensor(MouseSensor)])
  )

  const scrollToNow = () => {
    setTimeout(
      () =>
        $('#time-ruler-times').children()[0]?.scrollIntoView({
          inline: 'start',
          behavior: 'smooth',
        }),
      250
    )
  }

  useEffect(() => {
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('overflow', 'clip', 'important')
  }, [])

  const calendarMode = useAppStore((state) => state.calendarMode)
  useEffect(scrollToNow, [])

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setters.set({ dragData: null })}
      collisionDetection={pointerWithin}
      measuring={measuringConfig}
      sensors={sensors}
      autoScroll={false}
    >
      <div
        id='time-ruler'
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <DragOverlay dropAnimation={null}>{getDragElement()}</DragOverlay>
        <Buttons {...{ times, datesShown, setDatesShown, datesShownState }} />
        <Timer />
        <div
          className={`flex h-full w-full snap-x snap-mandatory !overflow-x-auto overflow-y-clip rounded-lg bg-primary-alt text-base child:flex-none child:snap-start child:p-2 ${childWidth}`}
          id='time-ruler-times'
          data-auto-scroll='x'
        >
          {times.map((time, i) => (
            <Timeline key={time.startISO + '::' + time.type} {...time} />
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

const Buttons = ({ times, datesShown, datesShownState, setDatesShown }) => {
  const now = DateTime.now()

  const scrollToSection = (section: number) => {
    $('#time-ruler-times').children()[section]?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    })
  }

  const calendarMode = useAppStore((state) => state.calendarMode)

  const nextButton = (
    <Button
      onClick={() => setDatesShown(datesShownState + 7)}
      src={'chevron-right'}
    />
  )

  const dayPadding = () => {
    return _.range(1, now.weekday).map((i) => <div key={i}></div>)
  }

  const buttonMaps = times.concat()
  buttonMaps.splice(1, 0, {})

  const unscheduledButton = (
    <Droppable id={'unscheduled::button'} data={{ scheduled: '' }}>
      <Button
        className={`h-[28px] ${calendarMode ? '!w-full flex-none' : ''}`}
        onClick={() => {
          setters.set({ searchStatus: 'unscheduled' })
        }}
      >
        Unscheduled
      </Button>
    </Droppable>
  )

  return (
    <>
      <div className={`flex w-full items-center space-x-1`}>
        <div
          className={`space-2 flex-none ${
            calendarMode
              ? 'grid grid-cols-2'
              : 'flex items-center justify-center'
          }`}
        >
          <Search />

          <Button
            title='reload'
            onClick={async () => {
              getters.getCalendarAPI().loadEvents()
              const obsidianAPI = getters.getObsidianAPI()
              setters.set({
                ...(await getDailyNoteInfo()),
              })
              obsidianAPI.loadTasks()
            }}
            src={'rotate-cw'}
          />

          <Button
            title='toggle day view'
            onClick={() => {
              setters.set({
                calendarMode: !calendarMode,
              })
            }}
            src={calendarMode ? 'calendar-days' : 'calendar'}
          ></Button>
          {calendarMode && nextButton}
        </div>
        <div
          className={`no-scrollbar flex w-full snap-mandatory rounded-icon pb-0.5 child:snap-start ${
            calendarMode
              ? 'max-h-[calc(28px*2+2px)] snap-y flex-wrap justify-around overflow-y-auto child:w-[calc(100%/7)]'
              : 'snap-x items-center space-x-2 overflow-x-auto'
          }`}
          data-auto-scroll={calendarMode ? 'y' : 'x'}
        >
          {calendarMode && dayPadding()}
          {unscheduledButton}
          {times.map((times, i) => {
            const thisDate = DateTime.fromISO(times.startISO)
            return (
              <Droppable
                key={times.startISO}
                id={times.startISO + '::button'}
                data={{ scheduled: times.startISO }}
              >
                <Button
                  className='h-[28px]'
                  onClick={() => scrollToSection(i)}
                  data-section-scroll={i}
                >
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
