import { useDraggable } from '@dnd-kit/core'
import Button from './Button'
import { getters, setters, useAppStore, AppState } from '../app/store'
import { Fragment, useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import moment from 'moment'
import {
  convertSearchToRegExp,
  getTodayNote,
  getTasksByHeading,
  parseDateFromPath,
  parseHeadingFromPath,
  parsePathFromDate,
} from '../services/util'
import { shallow } from 'zustand/shallow'
import { DateTime } from 'luxon'
import { TaskPriorities } from '../types/enums'
import _ from 'lodash'

export default function NewTask({ containerId }: { containerId: string }) {
  const data: DragData = {
    dragType: 'new_button',
  }
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `new_task_button::${containerId}`,
    data,
  })

  const newTask = useAppStore((state) => state.newTask)
  const frame = useRef<HTMLDivElement>(null)
  const inputFrame = useRef<HTMLInputElement>(null)

  const checkShowing = (ev: MouseEvent) => {
    invariant(frame.current)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(frame.current)) {
      setters.set({ newTask: false })
    }
  }

  useEffect(() => {
    window.removeEventListener('mousedown', checkShowing)
    if (newTask) {
      window.addEventListener('mousedown', checkShowing)
      setTimeout(() => inputFrame.current?.focus())
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [!!newTask])

  const [search, setSearch] = useState('')
  const searchExp = convertSearchToRegExp(search)

  const dailyNotePath = useAppStore((state) => state.dailyNotePath)
  const dailyNoteFormat = useAppStore((state) => state.dailyNoteFormat)
  const fileOrder = useAppStore((state) => state.fileOrder)
  const tasksByHeading = useAppStore(
    (state) =>
      !newTask
        ? []
        : getTasksByHeading(
            state.tasks,
            dailyNotePath,
            dailyNoteFormat,
            fileOrder
          ).filter(([heading]) => heading !== 'Daily'),
    shallow
  )

  const allHeadings: string[] = ['Daily']
    .concat(
      tasksByHeading.flatMap(([_name, tasks]) => {
        const subheadings = _.uniq(_.map(tasks, 'heading')).flatMap(
          (heading: string) => (heading ? tasks[0].path + '#' + heading : [])
        )
        return [tasks[0].path].concat(subheadings)
      })
    )
    .filter((heading) => searchExp.test(heading))

  const createInDaily = () => {
    invariant(newTask)

    const date = !newTask.scheduled
      ? (DateTime.now().toISODate() as string)
      : (DateTime.fromISO(newTask.scheduled).toISODate() as string)

    const path = parsePathFromDate(date, dailyNotePath, dailyNoteFormat)

    getters.getObsidianAPI().createTask(path, '', newTask)

    setTimeout(() => setters.set({ newTask: false }))
  }

  const createNewTask = () => {
    invariant(newTask)
    const selectedHeading = allHeadings[0]
    if (!allHeadings) {
      createInDaily()
    } else {
      const [filePath, splitHeading] = selectedHeading.split('#')
      getters.getObsidianAPI().createTask(filePath, splitHeading, newTask)
    }
  }

  return (
    <>
      <div
        className='relative z-[100] h-10 w-10 flex-none'
        {...attributes}
        {...listeners}
        ref={setNodeRef}
      >
        <Button
          className='h-full w-full cursor-grab rounded-full bg-accent child:invert'
          src='plus'
        />
      </div>
      {newTask && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-8 space-y-2'>
          <div
            className='flex h-full max-h-[50vh] w-full flex-col space-y-1 overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary p-2'
            ref={frame}
          >
            <div className='pl-2 font-menu text-lg font-bold text-center'>
              New Task
            </div>
            <div className='flex'>
              <input
                ref={inputFrame}
                className='w-full rounded-lg border border-solid border-faint bg-transparent font-menu font-light backdrop-blur !text-base px-1 py-2'
                value={newTask.originalTitle ?? ''}
                placeholder='title...'
                onChange={(ev) =>
                  setters.set({
                    newTask: { ...newTask, originalTitle: ev.target.value },
                  })
                }
                onKeyDown={(ev) => ev.key === 'Enter' && createInDaily()}
              ></input>
              <Button src='check' onClick={() => createInDaily()} />
            </div>
            <input
              placeholder='search files...'
              className='w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  createNewTask()
                }
              }}
            ></input>
            <div className='h-0 w-full grow space-y-1 overflow-y-auto text-sm'>
              {allHeadings.map((path) =>
                path === 'Daily' ? (
                  <div
                    className='selectable cursor-pointer rounded-lg px-2 font-bold text-accent hover:underline'
                    onClick={() => createInDaily()}
                    key='Daily'
                  >
                    Daily
                  </div>
                ) : (
                  <NewTaskHeading key={path} path={path} />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NewTaskHeading({ path }: { path: string }) {
  const dailyNotePath = useAppStore((state) => state.dailyNotePath)
  const dailyNoteFormat = useAppStore((state) => state.dailyNoteFormat)
  const { name, level } = parseHeadingFromPath(
    path,
    false,
    dailyNotePath,
    dailyNoteFormat
  )
  const newTask = useAppStore((state) => state.newTask)
  invariant(newTask)

  return (
    <div
      key={path}
      onMouseDown={() => {
        const [filePath, splitHeading] = path.split('#')
        getters.getObsidianAPI().createTask(filePath, splitHeading, newTask)

        setTimeout(() => setters.set({ newTask: false }))
      }}
      className={`selectable cursor-pointer rounded-lg px-2 hover:underline ${
        level === 'heading' ? 'text-muted' : 'font-bold text-accent'
      }`}
    >
      {name}
    </div>
  )
}
