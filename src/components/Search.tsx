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
  const allTasks: [string[], TaskProps][] = useMemo(
    () =>
      _.sortBy(
        _.values(tasks).filter(
          (task) => showCompleted || task.completed === showingPastDates
        ),
        'id'
      ).map((task) => [
        [
          (task.page ? parseFolderFromPath(task.path) : task.path) + task.title,
          task.tags.map((x) => '#' + x).join(' '),
          task.notes ?? '',
          priorityNumberToKey[task.priority],
          task.status,
        ],
        task,
      ]),
    [tasks]
  )
  const [search, setSearch] = useState('')
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

  const [headingFilterText, setHeadingFilterText] = useState('')
  const allHeadings = useAppStore((state) => {
    return [
      ...new Set(
        Object.values(state.tasks)
          .filter((task) => !task.page)
          .map((task) => getHeading(task, state.dailyNoteInfo, 'path'))
      ),
    ]
  }, shallow)

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

  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const filteredHeadings = useMemo(() => {
    const exp = convertSearchToRegExp(headingFilterText)
    return sortBy(
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
  }, [headingFilterText])
  console.log(filteredHeadings)

  const data: DragData = {
    dragType: 'new-task',
    title: search || 'Untitled',
    path:
      headingFilterText && filteredHeadings.length > 0
        ? filteredHeadings[0]
        : '',
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

  type Filter = {
    type: '!!' | '!' | '=' | undefined
    value: string | undefined
  }
  const [filter, setFilter] = useState<{ scheduled: Filter; due: Filter }>({
    scheduled: { type: undefined, value: undefined },
    due: { type: undefined, value: undefined },
  })
  useMemo(() => {
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
      return true
    })
  }, [foundTasks, filter])

  foundTasks = nestTasks(foundTasks, tasks)

  const movingTask = useAppStore((state) =>
    state.newTask?.type === 'move' ? state.newTask.task : false
  )
  console.log('movingTask search', movingTask)

  return (
    <div className='!fixed top-0 left-0 w-full h-full !z-50 px-1'>
      <div
        className='absolute top-0 left-0 w-full h-full'
        onClick={() => setters.set({ searchStatus: false, newTask: null })}
      ></div>
      <div className='prompt !w-full text-base'>
        {!movingTask ? (
          <>
            <div className='prompt-input-container px-1'>
              <input
                className='w-full h-8 !border !border-white/20 rounded-lg px-1 mb-1'
                style={{ fontFamily: 'var(--font-interface)' }}
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
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

        <div className='prompt-input-container px-1 group !flex !flex-col relative'>
          <input
            placeholder='heading'
            className='w-full h-8 !border !border-white/20 rounded-lg px-1 mb-1'
            style={{ fontFamily: 'var(--font-interface)' }}
            value={headingFilterText}
            onChange={(ev) => setHeadingFilterText(ev.target.value)}
          />
          <div
            className={`${
              movingTask
                ? 'block h-[300px]'
                : `hidden group-hover:block absolute top-9 h-[100px]`
            }bg-black/20 backdrop-blur-lg rounded-lg z-50 w-[calc(100%-24px)] px-4 overflow-y-auto`}
          >
            {filteredHeadings.map((heading) => {
              const [container, headingText] = splitHeading(heading)
              return (
                <div
                  key={heading}
                  className={`selectable flex rounded-icon font-menu text-xs group w-full mb-2`}
                >
                  <div
                    className={`w-full flex items-center`}
                    onClick={async () => {
                      if (movingTask) {
                        const obsidianApi = getters.getObsidianAPI()
                        await obsidianApi.moveTask(
                          movingTask as TaskProps,
                          heading
                        )
                        setters.set({ newTask: null, searchStatus: false })
                      } else {
                        setHeadingFilterText(headingText)
                      }
                    }}
                  >
                    <div
                      className={`w-fit flex-none max-w-[50%] text-normal truncate`}
                    >
                      {headingText}
                    </div>
                    <hr className='border-t border-t-faint opacity-50 mx-2 h-0 my-0 w-full'></hr>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!movingTask && (
          <>
            <div className='flex w-full px-4 space-x-2'>
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
