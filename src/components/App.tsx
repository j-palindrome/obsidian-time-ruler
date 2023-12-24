import {
  DndContext,
  DragOverlay,
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
import { Platform } from 'obsidian'
import { getAPI } from 'obsidian-dataview'
import { Fragment, useEffect, useRef, useState } from 'react'
import { onDragEnd, onDragStart } from 'src/services/dragging'
import invariant from 'tiny-invariant'
import {
  AppState,
  getters,
  setters,
  useAppStore,
  useAppStoreRef,
} from '../app/store'
import { useAutoScroll } from '../services/autoScroll'
import ObsidianAPI, { getDailyNoteInfo } from '../services/obsidianApi'
import {
  getToday,
  scrollToSection,
  toISO,
  useChildWidth,
} from '../services/util'
import Block from './Block'
import Button from './Button'
import Day from './Day'
import Deadline from './Deadline'
import Droppable from './Droppable'
import Group from './Group'
import Logo from './Logo'
import { NowTime, TimeSpanTypes } from './Minutes'
import NewTask from './NewTask'
import Search from './Search'
import Task from './Task'
import { Timer } from './Timer'
import Unscheduled from './Unscheduled'
import { ViewMode } from '../app/store'

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
      groupBy: apis.obsidian.getSetting('groupBy'),
      dayStartEnd: apis.obsidian.getSetting('dayStartEnd'),
      showCompleted: apis.obsidian.getSetting('showCompleted'),
      extendBlocks: apis.obsidian.getSetting('extendBlocks'),
      hideTimes: apis.obsidian.getSetting('hideTimes'),
    }

    setters.set({
      apis,
      dailyNoteInfo,
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

  const today = DateTime.fromISO(getToday())
  const [weeksShownState, setWeeksShown] = useState(1)
  const viewMode = useAppStore((state) => state.viewMode)
  const datesShown =
    viewMode === 'now' ? 0 : weeksShownState * 7 * (showingPastDates ? -1 : 1)

  const dayStart = useAppStore((state) => state.settings.dayStartEnd[0])
  const times: (Parameters<typeof Day>[0] | { type: 'unscheduled' })[] = [
    { type: 'unscheduled' },
    {
      startISO: toISO(today.plus({ hours: dayStart })),
      endISO: showingPastDates
        ? toISO(DateTime.now())
        : toISO(today.plus({ hours: dayStart, days: 1 })),
      type: 'minutes',
      dragContainer: 'app',
    },
    ..._.range(showingPastDates ? -1 : 1, datesShown).map((i) => ({
      startISO: toISO(today.plus({ days: i, hours: dayStart })),
      endISO: toISO(today.plus({ days: i + 1, hours: dayStart })),
      type: 'minutes' as TimeSpanTypes,
      dragContainer: 'app',
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
      case 'block':
        return <Block {...activeDrag} dragging />
      case 'due':
        return <Deadline {...activeDrag} isDragging />
      case 'new_button':
        return <NewTask dragContainer='activeDrag' />
      case 'now':
        return <NowTime dragContainer='activeDrag' />
    }
  }

  const scroller = useRef<HTMLDivElement>(null)
  const [scrollViews, setScrollViews] = useState([-1, 1])

  const container = useRef<HTMLDivElement>(null)
  const calendarMode = viewMode === 'week'

  const { childWidth, childClass } = useChildWidth({
    container,
  })

  const trueChildWidth = useAppStore((state) => state.childWidth)

  const updateScroll = () => {
    if (!scroller.current) return
    const scrollWidth = scroller.current.getBoundingClientRect().width
    if (scrollWidth === 0) return
    const scrolledToChild =
      scroller.current.scrollLeft / (scrollWidth / childWidth)
    const leftLevel = Math.floor(scrolledToChild)
    const rightLevel = Math.ceil(scrolledToChild + childWidth)

    if (leftLevel !== scrollViews[0] || rightLevel !== scrollViews[1]) {
      setScrollViews([leftLevel, rightLevel])
    }
  }
  useEffect(updateScroll, [childWidth])

  useEffect(() => {
    updateScroll()
  }, [calendarMode])

  useEffect(() => {
    const childNodes = $('#time-ruler-times')[0].childNodes
    const firstElement = childNodes.item(
      showingPastDates ? childNodes.length - 2 : 1
    ) as HTMLElement
    $('#time-ruler-times').scrollLeft(firstElement.offsetLeft)
  }, [calendarMode, showingPastDates])

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
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('padding', '4px 8px 8px', 'important')
  }, [])

  const frameClass =
    'p-0.5 child:p-1 child:bg-primary-alt child:rounded-lg child:h-full child:w-full'

  const dayPadding = (time: (typeof times)[number]) => {
    invariant(time.type !== 'unscheduled')
    const startDate = DateTime.fromISO(time.startISO)
    return (
      <>
        {_.range(startDate.weekday < 4 ? 1 : 5, startDate.weekday).map(
          (day) => (
            <div key={day} className={`${frameClass}`}>
              <div className='flex-col'>
                <div className='font-menu pl-8 text-faint flex-none'>
                  {now
                    .startOf('week')
                    .plus({ days: day - 1 })
                    .toFormat('EEE d')}
                </div>
                <div className='grow h-0 w-full rounded-lg bg-secondary-alt'></div>
              </div>
            </div>
          )
        )}
      </>
    )
  }

  const searchStatus = useAppStore((state) => state.searchStatus)

  return (
    <>
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
              width: `calc((100% - 48px) / ${trueChildWidth})`,
            }}
          >
            {getDragElement()}
          </DragOverlay>

          {viewMode !== 'now' && (
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
          )}
          <div className='w-full flex items-center h-5 flex-none my-1'>
            <Timer />
          </div>

          <div
            className={`flex h-full w-full snap-mandatory rounded-lg text-base child:flex-none child:snap-start ${childClass} ${
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
              return time.type === 'unscheduled' ? (
                <div
                  key='unscheduled'
                  id='time-ruler-unscheduled'
                  className={`${frameClass} ${calendarMode ? '!w-full' : ''}`}
                >
                  {isShowing && <Unscheduled />}
                </div>
              ) : (
                <Fragment key={time.startISO + '::' + time.type}>
                  {calendarMode &&
                    i === (showingPastDates ? 0 : 1) &&
                    childWidth > 1 &&
                    dayPadding(time)}
                  <div
                    id={`time-ruler-${time.startISO.slice(0, 10)}`}
                    className={frameClass}
                  >
                    {isShowing && <Day {...time} dragContainer='app' />}
                  </div>
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
      {searchStatus && <Search />}
    </>
  )
}

const Buttons = ({
  times,
  weeksShownState,
  setWeeksShown,
  setupStore,
  showingPastDates,
}) => {
  const now = DateTime.now()

  const viewMode = useAppStore((state) => state.viewMode)

  useEffect(() => {
    $(`#time-ruler-${getToday()}`)[0]?.scrollIntoView()
  }, [viewMode, showingPastDates])

  useEffect(() => {
    scrollToSection(getToday())
  }, [])

  const nextButton = (
    <div className='flex'>
      <Button
        onClick={() => setWeeksShown(weeksShownState + 1)}
        src={'chevron-right'}
      />
      {weeksShownState > 0 && (
        <Button
          className={`force-hover rounded-lg`}
          onClick={() => setWeeksShown(weeksShownState - 1)}
          src='chevron-left'
        />
      )}
    </div>
  )

  const buttonMaps = times.concat()
  buttonMaps.splice(1, 0, {})

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

  const renderButton = (time, i) => {
    const thisDate = DateTime.fromISO(time.startISO)
    return (
      <Droppable
        key={time.startISO ?? 'unscheduled'}
        id={time.startISO + '::button'}
        data={{ scheduled: time.startISO?.slice(0, 10) ?? '' }}
      >
        <Button
          className='h-[28px]'
          onClick={() =>
            scrollToSection(
              !time.startISO ? 'unscheduled' : time.startISO.slice(0, 10)
            )
          }
        >
          {time.type === 'unscheduled'
            ? 'Unscheduled'
            : time.startISO === today
            ? 'Today'
            : time.startISO === yesterday
            ? 'Yesterday'
            : time.startISO === tomorrow
            ? 'Tomorrow'
            : thisDate.toFormat('EEE MMM d')}
        </Button>
      </Droppable>
    )
  }

  const hideTimes = useAppStore((state) => state.settings.hideTimes)

  return (
    <>
      <div className={`flex w-full items-center space-x-1 rounded-lg`}>
        <div
          className='group relative'
          onClick={(ev) => setShowingModal(!showingModal)}
          ref={modalFrame}
        >
          <Button src='more-horizontal' />
          {showingModal && (
            <div
              className='tr-menu'
              onClick={(ev) => {
                ev.stopPropagation()
                ev.preventDefault()
              }}
            >
              <div className='flex flex-col items-center'>
                <div
                  className='clickable-icon w-full'
                  onClick={() => {
                    setters.set({ showingPastDates: !showingPastDates })
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
                  className='clickable-icon w-full'
                  onClick={async () => {
                    setupStore()
                  }}
                >
                  <Logo src={'rotate-cw'} className='w-6 flex-none' />
                  <span className='whitespace-nowrap'>Reload</span>
                </div>
                <div
                  className='clickable-icon w-full'
                  onClick={() => {
                    getters.getObsidianAPI().setSetting({
                      hideTimes: !hideTimes,
                    })
                  }}
                >
                  <Logo src={'kanban'} className='w-6 flex-none rotate-90' />
                  <span className='whitespace-nowrap'>
                    {hideTimes ? 'Show' : 'Hide'} Times
                  </span>
                </div>
                <div className='text-muted my-1 w-fit'>Group By</div>
                <div className='flex w-fit'>
                  {[
                    ['path', 'Path', 'folder-tree'],
                    ['priority', 'Priority', 'alert-circle'],
                    ['hybrid', 'Hybrid', 'arrow-down-narrow-wide'],
                    [false, 'None', 'x'],
                  ].map(
                    ([groupBy, title, src]: [
                      AppState['settings']['groupBy'],
                      string,
                      string
                    ]) => (
                      <div className='flex flex-col items-center'>
                        <Button
                          src={src}
                          title={title}
                          className='w-6 flex-none'
                          onClick={() => {
                            getters.getObsidianAPI().setSetting({
                              groupBy: groupBy,
                            })
                          }}
                        />
                        <div className='text-xs text-faint'>{title}</div>
                      </div>
                    )
                  )}
                </div>
                <div className='text-muted my-1 w-fit'>Layout</div>
                <div className='flex w-fit'>
                  {[
                    ['hour', 'Hours', 'square'],
                    ['day', 'Days', 'gallery-horizontal'],
                    ['week', 'Weeks', 'layout-grid'],
                  ].map(
                    ([viewMode, title, src]: [
                      AppState['viewMode'],
                      string,
                      string
                    ]) => (
                      <div className='flex flex-col items-center'>
                        <Button
                          src={src}
                          title={title}
                          className='w-6 flex-none'
                          onClick={() => {
                            setters.set({
                              viewMode,
                            })
                          }}
                        />
                        <div className='text-xs text-faint'>{title}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          src='search'
          onClick={() => setters.set({ searchStatus: true })}
        />

        <div
          className={`no-scrollbar flex w-full snap-mandatory rounded-icon pb-0.5 child:snap-start snap-x items-center space-x-2 overflow-x-auto`}
          data-auto-scroll='x'
        >
          {times.map((time, i) => {
            return renderButton(time, i)
          })}

          {nextButton}
        </div>
      </div>
    </>
  )
}
