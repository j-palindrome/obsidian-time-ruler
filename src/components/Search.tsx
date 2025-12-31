import _, { filter, isUndefined, set, sortBy } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getters, setters, useAppStore, useAppStoreRef } from 'src/app/store'
import { openTaskInRuler } from 'src/services/obsidianApi'
import {
  convertSearchToRegExp,
  getHeading,
  parseFileFromPath,
  splitHeading,
  toISO,
} from 'src/services/util'
import { parseFolderFromPath } from '../services/util'
import { priorityNumberToKey } from '../types/enums'
import Task from './Task'
import Group from './Group'
import Block from './Block'
import {
  DndContext,
  MeasuringConfiguration,
  MouseSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core'
import { onDragEnd, onDragStart } from 'src/services/dragging'
import { Platform } from 'obsidian'
import { nestTasks } from 'src/services/nestTasks'
import Button from './Button'
import { DateTime } from 'luxon'
import { shallow } from 'zustand/shallow'

export default function Search() {
  const tasks = useAppStore((state) => state.tasks)
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const search = useAppStore((state) => state.search)
  const headingFilterText = useAppStore((state) => state.headingFilterText)
  const allTasks: [string[], TaskProps][] = useMemo(
    () =>
      _.sortBy(
        _.values(tasks).filter(
          (task) => showCompleted || task.completed === showingPastDates
        ),
        'id'
      ).map((task) => {
        if (task.path.includes('AMS Work')) {
          console.log(
            (task.page ? parseFolderFromPath(task.path) : task.path).replace(
              '.md',
              ''
            ) +
              '/' +
              task.title
          )
        }
        return [
          [
            (task.page ? parseFolderFromPath(task.path) : task.path).replace(
              '.md',
              ''
            ) +
              '/' +
              task.title,
            task.tags.map((x) => '#' + x).join(' '),
            task.notes ?? '',
            priorityNumberToKey[task.priority],
            task.status,
          ],
          task,
        ]
      }),
    [tasks]
  )
  const searchExp = convertSearchToRegExp(search)
  const gatherChildren = (task: TaskProps): TaskProps[] => {
    return !task
      ? []
      : [
          task,
          ...task.children
            .concat(task.queryChildren ?? [])
            .flatMap((x) => gatherChildren(tasks[x])),
        ]
  }

  let foundTasks = allTasks
    .filter(
      ([strings]) =>
        strings.find(
          (string) => !search || (string && searchExp.test(string))
        ) &&
        strings.find(
          (string) =>
            !headingFilterText || (string && string.includes(headingFilterText))
        )
    )
    .map((x) => x[1])
    .flatMap((task) => gatherChildren(task))

  // Extract unique first path segments
  const pathSegments = useMemo(() => {
    const segments = new Set<string>()
    foundTasks.forEach((task) => {
      const path = task.page ? parseFolderFromPath(task.path) : task.path
      if (path) {
        const firstSegment = path.split('/')[0]
        if (firstSegment) segments.add(firstSegment)
      }
    })
    return Array.from(segments).sort()
  }, [foundTasks])

  type Filter = {
    type: '!!' | '!' | '=' | undefined
    value: string | undefined
  }
  const [filter, setFilter] = useState<{
    scheduled: Filter
    due: Filter
    pathSegment?: string
  }>({
    scheduled: { type: undefined, value: undefined },
    due: { type: undefined, value: undefined },
    pathSegment: undefined,
  })

  foundTasks = foundTasks.filter((task) => {
    if (!isUndefined(filter.scheduled.type)) {
      switch (filter.scheduled.type) {
        case '!!':
          if (!task.scheduled) return false
          break
        case '!':
          if (task.scheduled) return false
          break
      }
    }
    if (!isUndefined(filter.due.type)) {
      switch (filter.due.type) {
        case '!!':
          if (!task.due) return false
          break
        case '!':
          if (task.due) return false
          break
      }
    }
    if (filter.pathSegment) {
      const path = task.path
      const segments = path.split('/')
      if (!segments.some((x) => x === filter.pathSegment)) return false
    }
    return true
  })

  const allHeadings = useAppStore((state) => {
    return [
      ...new Set(
        Object.values(foundTasks)
          .filter((task) => !task.page)
          .map((task) => {
            const heading = getHeading(task, state.dailyNoteInfo, 'path')
            if (heading.includes('#')) {
              return heading.replace(/#.+$/, '')
            }
            return heading
          })
      ),
    ]
  }, shallow)

  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const exp = convertSearchToRegExp(headingFilterText)
  const filteredHeadings = sortBy(
    allHeadings.filter((x) => exp.test(x)),
    (heading) => {
      if (!headingFilterText) return heading
      let match = 0
      let score = 0
      for (let letter of heading) {
        if (letter === headingFilterText[match]) {
          match++
          if (match >= headingFilterText.length) break
        } else {
          score++
        }
      }
      return score
    }
  )

  const [addEvent, setAddEvent] = useState<{
    email: string
    id: string
  } | null>(null)
  const [showCalendarSelector, setShowCalendarSelector] = useState(false)
  const [headingInputFocused, setHeadingInputFocused] = useState(false)
  const availableCalendars = useMemo(() => {
    const cals = getters.getObsidianAPI().getSetting('google')
    let calIds = {}
    for (let name in cals) {
      calIds[name] = sortBy(
        Object.entries(cals[name].calendarIds)
          .filter((x) => x[1].show)
          .map((x) => ({ name: x[1].calendar.summary, id: x[0], email: name })),
        'name'
      )
    }
    return calIds
  }, [])
  const data: DragData = {
    dragType: 'new-task',
    title: search || 'Untitled',
    path:
      headingFilterText && filteredHeadings.length > 0
        ? filteredHeadings[0]
        : '',
    calendar: addEvent ? { email: addEvent.email, id: addEvent.id } : undefined,
  }
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'search-input',
    data,
  })

  const display = useAppStore((state) => !state.dragData)
  useEffect(() => {
    if (!display) {
      setTimeout(() => {
        setters.set({ searchStatus: false, newTask: null })
      }, 500)
    }
  }, [display])

  foundTasks = nestTasks(foundTasks, tasks)

  const movingTask = useAppStore((state) =>
    state.newTask?.type === 'move' ? state.newTask.task : false
  )

  return (
    <div className='!fixed top-0 left-0 w-full h-full !z-50 px-1'>
      <div
        className='absolute top-0 left-0 w-full h-full'
        onClick={() => setters.set({ searchStatus: false, newTask: null })}
      ></div>
      <div className='prompt !w-[calc(100%-theme(space.4))] text-base !px-1 !py-2'>
        {!movingTask ? (
          <>
            <div className='prompt-input-container px-1'>
              <input
                className='w-full h-8 !border !border-white/20 rounded-lg px-1 mb-1'
                style={{ fontFamily: 'var(--font-interface)' }}
                value={search}
                onChange={(ev) => setters.setSearch(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Escape')
                    setters.set({ searchStatus: false, newTask: null })
                  else if (ev.key === 'Enter') {
                    if (foundTasks[0]) openTaskInRuler(foundTasks[0].id)
                    setters.set({ searchStatus: false, newTask: null })
                  }
                }}
                placeholder='task'
                ref={input}
              />

              {search && (
                <Button
                  className='w-8 h-8 bg-grey-500/50 !cursor-pointer rounded-full flex-none'
                  onClick={() => setters.setSearch('')}
                  src={'circle-x'}
                ></Button>
              )}

              <Button
                className={`w-8 h-8 bg-grey-500/50 !cursor-pointer rounded-full flex-none ${
                  showCalendarSelector ? '!bg-accent' : ''
                }`}
                onClick={() => {
                  if (showCalendarSelector && addEvent) {
                    setAddEvent(null)
                  }
                  setShowCalendarSelector(!showCalendarSelector)
                }}
                src={'calendar'}
              ></Button>

              <Button
                className='w-8 h-8 bg-grey-500/50 !cursor-grab rounded-full flex-none'
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                src={'plus'}
              ></Button>
            </div>
          </>
        ) : (
          <div className='font-bold text-lg px-2 py-1'>{movingTask?.title}</div>
        )}
        {showCalendarSelector && (
          <div className='w-full bg-black/20 backdrop-blur-lg rounded-lg z-50 p-2 overflow-x-auto h-fit flex-none'>
            <div className='flex gap-2 whitespace-nowrap'>
              {Object.entries(availableCalendars).flatMap(([email, cals]) =>
                (cals as any).map((cal) => (
                  <Button
                    key={`${email}-${cal.id}`}
                    className={`flex-none px-2 py-1 rounded-lg text-xs whitespace-nowrap ${
                      addEvent?.email === email && addEvent?.id === cal.id
                        ? '!bg-accent !text-primary'
                        : 'bg-grey-500/50'
                    }`}
                    onClick={() => {
                      setAddEvent({ email, id: cal.id })
                    }}
                  >
                    {cal.name}
                  </Button>
                ))
              )}
            </div>
          </div>
        )}
        {pathSegments.length > 0 && (
          <div className='flex w-full px-2 space-x-2 overflow-x-auto no-scrollbar h-6 flex-none mt-1 '>
            <Button
              className={`${
                !filter.pathSegment ? '!bg-accent !text-primary' : ''
              } flex-none`}
              onClick={() => {
                setFilter({ ...filter, pathSegment: undefined })
              }}
            >
              All Paths
            </Button>
            {pathSegments.map((segment) => (
              <Button
                key={segment}
                className={`${
                  filter.pathSegment === segment
                    ? '!bg-accent !text-primary'
                    : ''
                } flex-none`}
                onClick={() => {
                  setFilter({ ...filter, pathSegment: segment })
                }}
              >
                {segment}
              </Button>
            ))}
          </div>
        )}

        <div className='flex w-full px-2 space-x-2 overflow-x-auto no-scrollbar h-6 flex-none mt-1'>
          <Button
            className={`${
              !headingFilterText ? '!bg-accent !text-primary' : ''
            } flex-none`}
            onClick={() => {
              setters.setHeadingFilterText('')
            }}
          >
            All Headings
          </Button>
          {filteredHeadings.map((heading) => {
            const [container, headingText] = splitHeading(heading)
            return (
              <Button
                key={heading}
                className={`${
                  headingFilterText === headingText
                    ? '!bg-accent !text-primary'
                    : ''
                } flex-none`}
                onClick={async () => {
                  if (movingTask) {
                    const obsidianApi = getters.getObsidianAPI()
                    await obsidianApi.moveTask(movingTask as TaskProps, heading)
                    setters.set({ newTask: null, searchStatus: false })
                  } else {
                    setters.setHeadingFilterText(headingText)
                  }
                  setHeadingInputFocused(false)
                }}
              >
                {headingText}
              </Button>
            )
          })}
        </div>

        {!movingTask && (
          <>
            <div className='flex w-full px-2 space-x-2 mt-1'>
              <Button
                className={`${
                  filter.scheduled.type === undefined
                    ? '!bg-accent !text-primary'
                    : ''
                }`}
                onClick={(ev) => {
                  setFilter({
                    due: { type: undefined, value: undefined },
                    scheduled: { type: undefined, value: undefined },
                    pathSegment: undefined,
                  })
                }}
              >
                All
              </Button>
              <Button
                className={`${
                  filter.scheduled.type === '!'
                    ? '!bg-accent !text-primary'
                    : ''
                }`}
                onClick={(ev) => {
                  setFilter({
                    ...filter,
                    scheduled: { type: '!', value: undefined },
                  })
                }}
              >
                Unscheduled
              </Button>
              <Button
                className={`${
                  filter.scheduled.type === '!!'
                    ? '!bg-accent !text-primary'
                    : ''
                }`}
                onClick={(ev) => {
                  setFilter({
                    ...filter,
                    scheduled: { type: '!!', value: undefined },
                  })
                }}
              >
                Scheduled
              </Button>
              <Button
                className={`${
                  filter.due.type === '!!' ? '!bg-accent !text-primary' : ''
                }`}
                onClick={(ev) => {
                  setFilter({
                    ...filter,
                    due: { type: '!!', value: undefined },
                  })
                }}
              >
                Upcoming
              </Button>
            </div>

            <div className='prompt-results'>
              <Block
                type='all-day'
                tasks={foundTasks}
                events={[]}
                blocks={[]}
                dragContainer='search'
              />
            </div>
          </>
        )}

        <div className='prompt-instructions'></div>
      </div>
    </div>
  )
}
