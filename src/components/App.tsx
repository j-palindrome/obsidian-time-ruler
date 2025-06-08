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
import _, { cloneDeep } from 'lodash'
import { DateTime } from 'luxon'
import { Notice, Platform } from 'obsidian'
import { getAPI } from 'obsidian-dataview'
import { Fragment, useEffect, useRef, useState } from 'react'
import { sounds } from 'src/assets/assets'
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
import { getDailyNoteInfo } from '../services/obsidianApi'
import {
  getStartDate,
  getToday,
  roundMinutes,
  scrollToSection,
  toISO,
  useChildWidth,
} from '../services/util'
import Block from './Block'
import Button from './Button'
import Day from './Day'
import Droppable from './Droppable'
import Group from './Group'
import Logo from './Logo'
import { TimeSpanTypes } from './Minutes'
import NewTask from './NewTask'
import Search from './Search'
import Task from './Task'
import { isCallChain } from 'typescript'
import Now from './Now'

type TimesType = Parameters<typeof Day>[0][]

/**
 * @param apis: We need to store these APIs within the store in order to hold their references to call from the store itself, which is why we do things like this.
 */
export default function App({ apis }: { apis: Required<AppState['apis']> }) {
  const reload = async () => {
    const dv = getAPI()
    invariant(dv, 'please install Dataview to use Time Ruler.')
    if (!dv.index.initialized) {
      // @ts-ignore
      window.app.metadataCache.on('dataview:index-ready', () => {
        reload()
      })
      return
    }

    // reload settings
    apis.obsidian.reload()
    const dailyNoteInfo = await getDailyNoteInfo()

    const settings: AppState['settings'] = {
      muted: apis.obsidian.getSetting('muted'),
      twentyFourHourFormat: apis.obsidian.getSetting('twentyFourHourFormat'),
      groupBy: apis.obsidian.getSetting('groupBy'),
      dayStartEnd: apis.obsidian.getSetting('dayStartEnd'),
      showCompleted: apis.obsidian.getSetting('showCompleted'),
      extendBlocks: apis.obsidian.getSetting('extendBlocks'),
      hideTimes: apis.obsidian.getSetting('hideTimes'),
      borders: apis.obsidian.getSetting('borders'),
      viewMode: apis.obsidian.getSetting('viewMode'),
      timerEvent: apis.obsidian.getSetting('timerEvent'),
      scheduledSubtasks: apis.obsidian.getSetting('scheduledSubtasks'),
    }

    setters.set({
      apis,
      dailyNoteInfo,
      settings,
    })

    apis.calendar.loadEvents()
    apis.obsidian.loadTasks('', getters.get('showingPastDates'))
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

    const checkTimer = () => {
      const { startISO, maxSeconds, playing } = getters.get('timer')

      if (
        playing &&
        startISO &&
        maxSeconds &&
        new Date().toISOString() >= startISO
      ) {
        setters.patchTimer({
          maxSeconds: null,
          startISO: new Date().toISOString(),
          negative: true,
          playing: true,
        })
        if (getters.getApp().isMobile) {
          sounds.timer.play()
          new Notice('Timer complete')
        } else {
          switch (getters.get('settings').timerEvent) {
            case 'notification':
              new Notification('Timer complete')
              break
            case 'sound':
              sounds.timer.play()
              new Notice('Timer complete')
              break
          }
        }
      }
    }

    const timerInterval = window.setInterval(checkTimer, 1000)

    return () => {
      window.clearInterval(interval)
      window.clearInterval(timerInterval)
    }
  }, [])

  const showingPastDates = useAppStore((state) => state.showingPastDates)

  const today = DateTime.fromISO(getToday())
  const [weeksShownState, setWeeksShown] = useState(1)
  const viewMode = useAppStore((state) => state.settings.viewMode)
  const calendarMode = viewMode === 'week'
  const datesShown = weeksShownState * 7 * (showingPastDates ? -1 : 1)
  useEffect(() => {
    if (calendarMode) {
      setWeeksShown(4)
    } else {
      setWeeksShown(1)
    }
  }, [calendarMode])

  useEffect(() => {
    getters.getObsidianAPI()?.loadTasks('', showingPastDates)
  }, [weeksShownState, showingPastDates])

  const dayStart = useAppStore((state) => state.settings.dayStartEnd[0])
  const showCompleted = useAppStore((state) => state.settings.showCompleted)

  const times: TimesType = [
    {
      startISO:
        showingPastDates || showCompleted
          ? toISO(today.startOf('day').plus({ hours: dayStart }))
          : toISO(now),
      endISO: showingPastDates
        ? toISO(now)
        : toISO(today.plus({ days: 1, hours: dayStart })),
      type: 'minutes' as TimeSpanTypes,
      dragContainer: 'app',
      isNow: true,
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
    getters.getObsidianAPI()?.loadTasks('', showingPastDates)
  }, [searchWithinWeeks, showingPastDates])

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

  useAutoScroll()

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
        return <Task {...activeDrag} dragging />
      case 'task-length':
      case 'time':
        return <></>
      case 'group':
        return <Group {...activeDrag} />
      case 'block':
        return <Block {...activeDrag} dragging />
      case 'new_button':
        return <NewTask dragContainer='activeDrag' />
      case 'due':
        return <div className='h-line p-2 text-accent'>due</div>
    }
  }

  const scroller = useRef<HTMLDivElement>(null)
  const [scrollViews, setScrollViews] = useState([-1, 1])

  const { childWidth, childClass } = useChildWidth()

  const trueChildWidth = useAppStore((state) => state.childWidth)

  const updateScroll = () => {
    if (!scroller.current) return
    const scrollWidth = scroller.current.getBoundingClientRect().width
    const unscheduledWidth = scrollWidth
    if (scrollWidth === 0) return
    const scrolledToChild =
      scroller.current.scrollLeft > 0
        ? (scroller.current.scrollLeft - unscheduledWidth) /
            (scrollWidth / childWidth) +
          1
        : 0
    const leftLevel = Math.floor(scrolledToChild)
    const rightLevel = Math.ceil(scrolledToChild + childWidth)

    if (leftLevel !== scrollViews[0] || rightLevel !== scrollViews[1]) {
      setScrollViews([leftLevel, rightLevel])
    }
  }
  useEffect(updateScroll, [childWidth, calendarMode])

  useEffect(() => {
    updateScroll()
  }, [])

  useEffect(() => {
    const childNodes = $('#time-ruler-times')[0]?.childNodes
    if (!childNodes) return
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
              tolerance: 10,
            },
          }),
        ]
      : [useSensor(MouseSensor)])
  )

  useEffect(() => {
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('overflow', 'clip', 'important')
    $('#time-ruler')
      .parent()[0]
      ?.style?.setProperty('padding', '4px 8px 8px', 'important')
  }, [])

  const borders = useAppStore((state) => state.settings.borders)
  const frameClass = `p-0.5 child:p-1 child:bg-primary child:rounded-icon h-full ${
    borders ? 'child:border-solid child:border-divider child:border-[1px]' : ''
  }`

  const searchStatus = useAppStore((state) => state.searchStatus)

  const apisLoaded = useAppStore((state) => state.apis.obsidian)
  return (
    apisLoaded && (
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
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--background-secondary)',
            }}
            className={`time-ruler time-ruler-container sidebar-color`}
            id='time-ruler'
          >
            <DragOverlay
              dropAnimation={null}
              className='backdrop-blur opacity-50'
              style={{
                width:
                  activeDrag?.dragType === 'due'
                    ? undefined
                    : `calc((100% - 48px) / ${trueChildWidth})`,
              }}
            >
              {getDragElement()}
            </DragOverlay>

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

            <div
              className={`flex h-full w-full snap-mandatory rounded-icon text-base child:flex-none child:snap-start ${childClass} !overflow-x-auto overflow-y-clip child:h-full snap-x`}
              id='time-ruler-times'
              data-auto-scroll={calendarMode ? 'y' : 'x'}
              ref={scroller}
              onScroll={updateScroll}
            >
              <div id={`time-ruler-now`} className={frameClass}>
                <Now />
              </div>
              {times.map((time, i) => {
                const isShowing = i + 1 >= scrollViews[0] && i <= scrollViews[1]
                return (
                  <Fragment key={time.startISO + '::' + time.type}>
                    <div
                      id={`time-ruler-${getStartDate(
                        DateTime.fromISO(time.startISO)
                      )}`}
                      className={frameClass}
                    >
                      {isShowing && <Day {...time} />}
                    </div>
                  </Fragment>
                )
              })}
            </div>
            {searchStatus && <Search />}
          </div>
        </DndContext>
      </>
    )
  )
}

const Buttons = ({
  times,
  weeksShownState,
  setWeeksShown,
  setupStore,
  showingPastDates,
}: {
  times: TimesType
  weeksShownState: number
  setWeeksShown: (weeksShownState: number) => void
  setupStore: () => void
  showingPastDates: boolean
}) => {
  const now = toISO(roundMinutes(DateTime.now()))
  const viewMode = useAppStore((state) => state.settings.viewMode)
  const calendarMode = viewMode === 'week'

  useEffect(() => {
    $(`#time-ruler-${getToday()}`)[0]?.scrollIntoView()
  }, [viewMode, showingPastDates])

  const nextButton = (
    <div className='flex'>
      <Button
        onClick={() => setWeeksShown(weeksShownState + (calendarMode ? 4 : 1))}
        src={'chevron-right'}
      />
      {weeksShownState > (calendarMode ? 4 : 0) && (
        <Button
          className={`force-hover rounded-icon`}
          onClick={() =>
            setWeeksShown(weeksShownState - (calendarMode ? 4 : 1))
          }
          src='chevron-left'
        />
      )}
    </div>
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
    window.removeEventListener('click', checkShowing)
    if (showingModal) {
      window.addEventListener('click', checkShowing)
    }
    return () => window.removeEventListener('click', checkShowing)
  }, [showingModal])

  const renderButton = (time: TimesType[number], i) => {
    const start = getStartDate(DateTime.fromISO(time.startISO))
    const thisDate = start ? DateTime.fromISO(start) : undefined
    return (
      <Droppable
        key={time.startISO}
        id={start + '::button'}
        data={{
          scheduled: start,
        }}
      >
        <Button
          className='h-[28px]'
          onClick={() => scrollToSection(start!)}
          data-date-button={start}
        >
          {thisDate!.toFormat('EEE MMM d')}
        </Button>
      </Droppable>
    )
  }

  const hideTimes = useAppStore((state) => state.settings.hideTimes)
  const childWidth = useAppStore((state) => state.childWidth)

  return (
    <>
      <div className={`flex w-full items-center space-x-1 rounded-icon`}>
        <div
          className={`${
            calendarMode
              ? ''
              : 'flex justify-center h-full space-x-1 items-center'
          }`}
        >
          <div className='group relative'>
            <Button
              src='more-horizontal'
              onClick={(ev) => {
                setShowingModal(!showingModal)
                ev.stopPropagation()
              }}
            />
            {showingModal && (
              <div
                className='tr-menu'
                ref={modalFrame}
                onClick={() => setShowingModal(false)}
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
                      ['tags', 'Tags', 'hash'],
                      [false, 'None', 'x'],
                    ].map(
                      ([groupBy, title, src]: [
                        AppState['settings']['groupBy'],
                        string,
                        string
                      ]) => (
                        <div className='flex flex-col items-center' key={title}>
                          <Button
                            src={src}
                            title={title}
                            className={`${
                              getters.getApp().isMobile
                                ? '!w-8 !h-8'
                                : '!w-6 !h-6'
                            } !p-0 flex-none`}
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
                      ['day', 'Days', 'gallery-horizontal'],
                      ['week', 'Weeks', 'layout-grid'],
                    ].map(
                      ([viewMode, title, src]: [
                        AppState['settings']['viewMode'],
                        string,
                        string
                      ]) => (
                        <div className='flex flex-col items-center' key={title}>
                          <Button
                            src={src}
                            title={title}
                            className={`${
                              getters.getApp().isMobile
                                ? '!w-8 !h-8'
                                : '!w-6 !h-6'
                            } !p-0 flex-none`}
                            onClick={() => {
                              getters.getObsidianAPI().setSetting({
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
            className={`${calendarMode ? 'mb-2' : ''}`}
            onClick={() => setters.set({ searchStatus: true })}
          />
          {calendarMode && <NewTask dragContainer='buttons' />}
        </div>

        <div
          className={`no-scrollbar flex w-full snap-mandatory rounded-icon pb-0.5 child:snap-start overflow-x-auto ${
            calendarMode
              ? `overflow-y-auto snap-y flex-wrap h-[152px] ${
                  childWidth > 1 ? '*:w-[14.2%] *:!justify-start' : ''
                }`
              : 'overflow-x-auto snap-x space-x-2 items-center'
          }`}
          data-auto-scroll={calendarMode ? 'y' : 'x'}
        >
          <Droppable
            id={'now' + '::button'}
            data={{
              scheduled: now,
            }}
          >
            <Button
              className='h-[28px]'
              onClick={() => scrollToSection('now')}
              data-date-button
            >
              Now
            </Button>
          </Droppable>

          {times.map((time, i) => {
            return renderButton(time, i)
          })}

          {nextButton}
        </div>
        {!calendarMode && <NewTask dragContainer='buttons' />}
      </div>
    </>
  )
}
