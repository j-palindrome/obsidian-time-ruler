import _, { filter, isUndefined, set } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setters, useAppStore, useAppStoreRef } from 'src/app/store'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { convertSearchToRegExp, toISO } from 'src/services/util'
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
} from '@dnd-kit/core'
import { onDragEnd, onDragStart } from 'src/services/dragging'
import { Platform } from 'obsidian'
import { nestTasks } from 'src/services/nestTasks'
import Button from './Button'
import { DateTime } from 'luxon'

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
  let foundTasks = allTasks
    .filter(([strings]) =>
      strings.find((string) => !search || (string && searchExp.test(string)))
    )
    .map((x) => x[1])
    .flatMap((task) => gatherChildren(task))

  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const display = useAppStore((state) => !state.dragData)
  useEffect(() => {
    if (!display) {
      setTimeout(() => {
        setters.set({ searchStatus: false })
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

  return (
    <div className='!fixed top-0 left-0 w-full h-full !z-50 px-1'>
      <div
        className='absolute top-0 left-0 w-full h-full'
        onClick={() => setters.set({ searchStatus: false })}
      ></div>
      <div className='prompt !w-full text-base'>
        <div className='prompt-input-container'>
          <input
            className='prompt-input'
            style={{ fontFamily: 'var(--font-interface)' }}
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Escape') setters.set({ searchStatus: false })
              else if (ev.key === 'Enter') {
                if (foundTasks[0]) openTaskInRuler(foundTasks[0][1].id)
                setters.set({ searchStatus: false })
              }
            }}
            ref={input}
          />
        </div>
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
              filter.scheduled.type === '!' ? '!bg-accent !text-primary' : ''
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
              filter.scheduled.type === '!!' ? '!bg-accent !text-primary' : ''
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
        <div className='prompt-instructions'></div>
      </div>
    </div>
  )
}
