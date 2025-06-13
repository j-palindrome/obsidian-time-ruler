import _, { filter } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setters, useAppStore, useAppStoreRef } from 'src/app/store'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { convertSearchToRegExp } from 'src/services/util'
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
  const splitSearch = search.split('')
  const foundTasks = allTasks
    .filter(([strings]) =>
      strings.find((string) => !search || (string && searchExp.test(string)))
    )
    .map((x) => x[1])

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
