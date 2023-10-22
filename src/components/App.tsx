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
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import $ from 'jquery'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { Platform } from 'obsidian'
import { useEffect, useRef, useState } from 'react'
import useStateRef from 'react-usestateref'
import {
  AppState,
  getters,
  setters,
  useAppStore,
  useAppStoreRef,
} from '../app/store'
import { useAutoScroll } from '../services/autoScroll'
import { getDailyNoteInfo } from '../services/obsidianApi'
import { isTaskProps } from '../types/enums'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Group from './Group'
import Heading from './Heading'
import Logo from './Logo'
import Search from './Search'
import Task from './Task'
import Timeline from './Timeline'
import { Timer } from './Timer'
import { TimeSpanTypes } from './Times'
import DueDate from './DueDate'
import invariant from 'tiny-invariant'
import NewTask from './NewTask'
import { parseDateFromPath, parseHeadingFromPath } from '../services/util'
import { getAPI } from 'obsidian-dataview'

/**
 * @param apis: We need to store these APIs within the store in order to hold their references to call from the store itself, which is why we do things like this.
 */
export default function App({ apis }: { apis: Required<AppState['apis']> }) {
  const reload = async () => {
    const dv = getAPI()
    invariant(dv, 'please install Dataview to use Time Ruler.')
    if (!dv.index.initialized) {
      // @ts-ignore
      app.metadataCache.on('dataview:index-ready', () => {
        reload()
      })
      return
    }

    // reload settings
    apis.obsidian.getExcludePaths()
    const dailyNoteInfo = await getDailyNoteInfo()

    const dayStartEnd = apis.obsidian.getSetting('dayStartEnd')
    const hideHeadings = apis.obsidian.getSetting('hideHeadings')
    const twentyFourHourFormat = apis.obsidian.getSetting(
      'twentyFourHourFormat'
    )
    const muted = apis.obsidian.getSetting('muted')

    setters.set({
      apis,
      ...dailyNoteInfo,
      dayStartEnd,
      hideHeadings,
      twentyFourHourFormat,
      muted,
    })

    apis.calendar.loadEvents()
    apis.obsidian.loadTasks('')
  }

  useEffect(() => {
    reload()
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

    if (dragData?.dragType === 'new_button' && !dropData) {
      setters.set({ newTask: { scheduled: undefined } })
    } else if (dropData && dragData) {
      if (!isTaskProps(dropData)) {
        // use case with drag/drop of headings
        if (dropData.type === 'heading' && dragData.dragType === 'group') {
          setters.updateFileOrder(dragData.name, dropData.heading)
        }
      } else {
        switch (dragData.dragType) {
          case 'new_button':
            setters.set({ newTask: { scheduled: dropData.scheduled } })
            break
          case 'time':
          case 'task-length':
            if (!dropData.scheduled) return
            const { hours, minutes } = DateTime.fromISO(dropData.scheduled)
              .diff(DateTime.fromISO(dragData.start))
              .shiftTo('hours', 'minutes')
              .toObject() as { hours: number; minutes: number }
            if (dragData.dragType === 'task-length') {
              setters.patchTasks([dragData.id], {
                length: { hour: hours, minute: minutes },
              })
            } else {
              setters.set({
                newTask: {
                  scheduled: dropData.scheduled,
                  length: { hour: hours, minute: minutes },
                },
              })
            }
            break
          case 'new':
            const [path, heading] = dragData.path.split('#')
            getters.getObsidianAPI().createTask(path + '.md', heading, dropData)
            break
          case 'group':
          case 'event':
            setters.patchTasks(
              dragData.tasks.flatMap((x) =>
                x.type === 'parent' ? x.children : x.id
              ),
              dropData
            )
            break
          case 'task':
            setters.patchTasks([dragData.id], dropData)
            break
          case 'due':
            setters.patchTasks([dragData.task.id], { due: dropData.scheduled })
            break
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

    switch (activeDrag.dragType) {
      case 'task':
        return <Task {...activeDrag} />
      case 'task-length':
      case 'time':
        return <></>
      case 'group':
        return <Group {...activeDrag} />
      case 'event':
        return <Event {...activeDrag} isDragging={true} />
      case 'new':
        return (
          <Heading {...activeDrag} idString={`newTask::${activeDrag.path}`} />
        )
      case 'due':
        return <DueDate {...activeDrag} isDragging />
      case 'new_button':
        return <NewTask />
    }
  }

  const [childWidth, setChildWidth, childWidthRef] = useStateRef('child:w-full')
  const [overlayWidth, setOverlayWidth] = useState(1)

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
      const overlayWidths = {
        'child:w-full': 1,
        'child:w-1/2': 2,
        'child:w-1/3': 3,
        'child:w-1/4': 4,
      }
      if (newChildWidth !== childWidthRef.current) {
        setChildWidth(newChildWidth)
        setOverlayWidth(overlayWidths[newChildWidth])
      }
    }
    outputSize()

    if (Platform.isMobile) {
      setChildWidth('child:w-full')
      return
    }

    const timeRuler = document.querySelector('#time-ruler') as HTMLElement
    if (!timeRuler) return
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
        className={`time-ruler-container`}
      >
        <DragOverlay
          dropAnimation={null}
          style={{ width: `calc((100% - 48px) / ${overlayWidth})` }}
        >
          {getDragElement()}
        </DragOverlay>
        <Search />
        <Buttons
          {...{
            times,
            datesShown,
            setDatesShown,
            datesShownState,
            setupStore: reload,
          }}
        />
        <Timer />
        <div className='absolute bottom-6 left-6'>
          <NewTask />
        </div>
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

const Buttons = ({
  times,
  datesShown,
  datesShownState,
  setDatesShown,
  setupStore,
}) => {
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
      className={`${calendarMode ? '!w-full' : ''}`}
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
        className={`h-[28px]`}
        onClick={() => {
          setters.set({ searchStatus: 'unscheduled' })
        }}
      >
        Unscheduled
      </Button>
    </Droppable>
  )

  const [showingModal, setShowingModal] = useState(false)
  const modalFrame = useRef<HTMLDivElement>(null)
  const checkShowing = (ev: MouseEvent) => {
    invariant(modalFrame.current)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(modalFrame.current)) {
      setShowingModal(false)
    }
  }
  useEffect(() => {
    window.removeEventListener('mousedown', checkShowing)
    if (showingModal) {
      window.addEventListener('mousedown', checkShowing)
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [showingModal])

  return (
    <>
      <div className={`flex w-full items-center space-x-1`}>
        <div className='text-left'>
          <div className='group relative'>
            <Button
              src='more-horizontal'
              onClick={(ev) => setShowingModal(!showingModal)}
            />
            {showingModal && (
              <div className='tr-menu' ref={modalFrame}>
                <div className=''>
                  <div
                    className='clickable-icon'
                    onClick={() => {
                      setters.set({ searchStatus: 'all' })
                      setShowingModal(false)
                    }}
                  >
                    <Logo src={'search'} className='w-6 flex-none' />
                    <span className='whitespace-nowrap'>Search</span>
                  </div>
                  <div
                    className='clickable-icon'
                    onClick={async () => {
                      setupStore()
                      setShowingModal(false)
                    }}
                  >
                    <Logo src={'rotate-cw'} className='w-6 flex-none' />
                    <span className='whitespace-nowrap'>Reload</span>
                  </div>
                  <div
                    className='clickable-icon'
                    onClick={() => {
                      setters.set({
                        calendarMode: !calendarMode,
                      })
                      setShowingModal(false)
                    }}
                  >
                    <Logo
                      src={calendarMode ? 'calendar-days' : 'calendar'}
                      className='w-6 flex-none'
                    />
                    <span className='whitespace-nowrap'>{`${
                      calendarMode ? 'Hourly' : 'Daily'
                    } view`}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {calendarMode && unscheduledButton}
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
          {!calendarMode && unscheduledButton}
          {times.map((times, i) => {
            const thisDate = DateTime.fromISO(times.startISO)
            return (
              <Droppable
                key={times.startISO}
                id={times.startISO + '::button'}
                data={{ scheduled: times.startISO }}
              >
                <Button className='h-[28px]' onClick={() => scrollToSection(i)}>
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

          {nextButton}
        </div>
      </div>
    </>
  )
}
