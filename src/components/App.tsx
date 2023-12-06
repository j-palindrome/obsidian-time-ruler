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
import { Fragment, useEffect, useRef, useState } from 'react'
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
import Timeline, { NowTime } from './Timeline'
import { Timer } from './Timer'
import { TimeSpanTypes } from './Times'
import DueDate from './DueDate'
import invariant from 'tiny-invariant'
import NewTask from './NewTask'
import {
  parseDateFromPath,
  parseHeadingFromPath,
  toISO,
} from '../services/util'
import { getAPI } from 'obsidian-dataview'
import { onDragEnd, onDragStart } from 'src/services/dragging'

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

    const settings: AppState['settings'] = {
      muted: apis.obsidian.getSetting('muted'),
      twentyFourHourFormat: apis.obsidian.getSetting('twentyFourHourFormat'),
      hideHeadings: apis.obsidian.getSetting('hideHeadings'),
      dayStartEnd: apis.obsidian.getSetting('dayStartEnd'),
      showCompleted: apis.obsidian.getSetting('showCompleted'),
      extendBlocks: apis.obsidian.getSetting('extendBlocks'),
    }

    setters.set({
      apis,
      ...dailyNoteInfo,
      settings,
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

  const showingPastDates = useAppStore((state) => state.showingPastDates)

  const today = now.startOf('day')
  const [weeksShownState, setWeeksShown] = useState(1)

  const nextMonday = showingPastDates
    ? DateTime.now().minus({ weeks: weeksShownState }).startOf('week')
    : DateTime.now()
        .plus({ weeks: weeksShownState })
        .startOf('week')
        .plus({ days: 1 })
  const datesShown = _.floor(nextMonday.diff(DateTime.now()).as('days'))

  const times: Parameters<typeof Timeline>[0][] = [
    {
      startISO: today.toISODate() as string,
      endISO: showingPastDates
        ? toISO(DateTime.now())
        : (today.plus({ days: 1 }).toISODate() as string),
      type: 'minutes',
    },
    ..._.range(showingPastDates ? -1 : 1, datesShown).map((i) => ({
      startISO: today.plus({ days: i }).toISODate() as string,
      endISO: today.plus({ days: i + 1 }).toISODate() as string,
      type: 'minutes' as TimeSpanTypes,
    })),
  ]
  if (showingPastDates) times.reverse()

  const searchWithinWeeks = useAppStore((state) => state.searchWithinWeeks)

  useEffect(() => {
    getters.getObsidianAPI()?.loadTasks('')
  }, [searchWithinWeeks])

  useEffect(() => {
    if (showingPastDates && -weeksShownState < searchWithinWeeks[0]) {
      setters.set({
        searchWithinWeeks: [-weeksShownState, searchWithinWeeks[1]],
      })
    }
    if (!showingPastDates && weeksShownState > searchWithinWeeks[1]) {
      setters.set({
        searchWithinWeeks: [searchWithinWeeks[0], weeksShownState],
      })
    }
  }, [showingPastDates, weeksShownState])

  const [activeDrag, activeDragRef] = useAppStoreRef((state) => state.dragData)

  useAutoScroll(!!activeDrag)

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
      case 'due':
        return <DueDate {...activeDrag} isDragging />
      case 'new_button':
        return <NewTask dragContainer='activeDrag' />
      case 'now':
        return <NowTime dragContainer='activeDrag' />
    }
  }

  const [childWidth, setChildWidth, childWidthRef] = useStateRef(1)
  const childWidthToClass = [
    '',
    'child:w-full',
    'child:w-1/2',
    'child:w-1/3',
    'child:w-1/4',
  ]

  const scroller = useRef<HTMLDivElement>(null)
  const [scrollViews, setScrollViews] = useState([-1, 1])

  const container = useRef<HTMLDivElement>(null)

  const [calendarMode, calendarModeRef] = useAppStoreRef(
    (state) => state.calendarMode
  )

  function outputSize() {
    if (Platform.isMobile) {
      setChildWidth(1)
      return
    }
    const timeRuler = container.current as HTMLDivElement
    const width = timeRuler.clientWidth
    const newChildWidth =
      width < 500
        ? 1
        : width < 800
        ? 2
        : width < 1200 && !calendarModeRef.current
        ? 3
        : 4
    if (newChildWidth !== childWidthRef.current) {
      setChildWidth(newChildWidth)
    }
  }

  useEffect(() => {
    outputSize()
    const timeRuler = document.querySelector('#time-ruler') as HTMLElement
    if (!timeRuler) return
    const observer = new ResizeObserver(outputSize)
    observer.observe(timeRuler)
    window.addEventListener('resize', outputSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', outputSize)
    }
  }, [])

  const updateScroll = () => {
    invariant(scroller.current)
    const scrollWidth = scroller.current.getBoundingClientRect().width
    if (scrollWidth === 0) return
    const leftLevel = Math.floor(
      scroller.current.scrollLeft / (scrollWidth / childWidth)
    )
    const rightLevel = leftLevel + childWidth + 1
    if (leftLevel !== scrollViews[0] || rightLevel !== scrollViews[1])
      setScrollViews([leftLevel, rightLevel])
  }
  useEffect(updateScroll, [childWidth])

  useEffect(() => {
    outputSize()
    updateScroll()
  }, [calendarMode])

  const scrollToNow = () => {
    setTimeout(() => {
      const targetChild = showingPastDates
        ? $('#time-ruler-times').children().last()
        : $('#time-ruler-times').children().first()

      targetChild?.[0].scrollIntoView({
        inline: showingPastDates ? 'end' : 'start',
      })
    }, 250)
  }

  useEffect(() => scrollToNow(), [calendarMode, showingPastDates])

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

  useEffect(() => {
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('overflow', 'clip', 'important')
  }, [])

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={(ev) => onDragEnd(ev, activeDragRef)}
      onDragCancel={() => setters.set({ dragData: null })}
      collisionDetection={pointerWithin}
      measuring={measuringConfig}
      sensors={sensors}
      autoScroll={false}
    >
      <div
        id='time-ruler'
        ref={container}
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
          style={{
            width: `calc((100% - 48px) / ${childWidth})`,
          }}
        >
          {getDragElement()}
        </DragOverlay>
        <Search />
        <Buttons
          {...{
            times,
            datesShown,
            setWeeksShown,
            weeksShownState,
            setupStore: reload,
            showingPastDates,
          }}
        />
        <div className='w-full flex items-center h-5 flex-none space-x-2 mb-2 mt-1 relative'>
          <Timer />
          <div className='absolute right-0 top-full flex space-x-2 pt-3 pr-3'>
            {activeDrag && activeDrag.dragType === 'task' && (
              <Droppable id={`delete-task`} data={{ type: 'delete' }}>
                <Button src='x' className='!rounded-full h-8 w-8 bg-red-900' />
              </Droppable>
            )}
            <NewTask dragContainer='main' />
          </div>
        </div>
        <div
          className={`flex h-full w-full snap-mandatory  rounded-lg bg-primary-alt text-base child:flex-none child:snap-start child:p-2 ${
            childWidthToClass[childWidth]
          } ${
            calendarMode
              ? 'flex-wrap overflow-y-auto overflow-x-hidden snap-y justify-center child:h-1/2'
              : 'snap-x !overflow-x-auto overflow-y-clip child:h-full'
          }`}
          id='time-ruler-times'
          data-auto-scroll={calendarMode ? 'y' : 'x'}
          ref={scroller}
          onScroll={updateScroll}
        >
          {times.map((time, i) => {
            const isShowing =
              calendarMode || (i >= scrollViews[0] && i <= scrollViews[1])

            return (
              <Fragment key={time.startISO + '::' + time.type}>
                {calendarMode && i === 0 && (
                  <>
                    {_.range(1, DateTime.fromISO(time.startISO).weekday).map(
                      (day) => (
                        <div key={day} className='!h-0' />
                      )
                    )}
                  </>
                )}
                <div>{isShowing && <Timeline {...time} />}</div>
                {calendarMode &&
                DateTime.fromISO(time.startISO).weekday === 7 ? (
                  <div className='!h-0 !w-1'></div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
      </div>
    </DndContext>
  )
}

const Buttons = ({
  times,
  datesShown,
  weeksShownState,
  setWeeksShown,
  setupStore,
  showingPastDates,
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
    <div className='flex'>
      <Button
        className={`${calendarMode ? '!w-full' : ''}`}
        onClick={() => setWeeksShown(weeksShownState + 1)}
        src={'chevron-right'}
      />
      {weeksShownState > 0 && (
        <Button
          className={`force-hover rounded-lg ${calendarMode ? '' : '!w-8'}`}
          onClick={() => setWeeksShown(weeksShownState - 1)}
          src='chevron-left'
        />
      )}
    </div>
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

  const today = now.toISODate()
  const yesterday = now.minus({ days: 1 }).toISODate()
  const tomorrow = now.plus({ days: 1 }).toISODate()
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
                    onClick={() => {
                      setters.set({ showingPastDates: !showingPastDates })
                      setShowingModal(false)
                    }}
                  >
                    <Logo
                      src={showingPastDates ? 'chevron-right' : 'chevron-left'}
                      className='w-6 flex-none'
                    />
                    <span className='whitespace-nowrap'>
                      {showingPastDates ? 'Future' : 'Past'}
                    </span>
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
                  {times.startISO === today
                    ? 'Today'
                    : times.startISO === yesterday
                    ? 'Yesterday'
                    : times.startISO === tomorrow
                    ? 'Tomorrow'
                    : thisDate.toFormat(
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
