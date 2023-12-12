import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import {
  convertSearchToRegExp,
  parseFileFromPath,
  parseFolderFromPath,
  parseHeadingFromPath,
  parseHeadingTitle,
} from '../services/util'
import Button from './Button'
import Droppable from './Droppable'

export default function NewTask({ dragContainer }: { dragContainer: string }) {
  const data: DragData = {
    dragType: 'new_button',
  }
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `new_task_button::${dragContainer}`,
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

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const allHeadings: string[] = useAppStore((state) => {
    if (!newTask) return []
    return _.uniq(
      _.flatMap(state.tasks, (task) => {
        if (task.completed) return []
        const heading = parseHeadingFromPath(
          task.path,
          task.page,
          dailyNoteInfo
        )
        return heading.includes('#')
          ? [heading, parseFileFromPath(heading)]
          : heading
      })
    ).sort()
  }, shallow)

  const searchExp = convertSearchToRegExp(search)
  const filteredHeadings = allHeadings.filter((heading) =>
    searchExp.test(heading)
  )

  useEffect(() => {
    setSearch('')
  }, [newTask])

  const draggingTask = useAppStore(
    (state) =>
      state.dragData &&
      ['task', 'group', 'block'].includes(state.dragData.dragType)
  )

  return (
    <div className='flex relative z-30'>
      {draggingTask && (
        <Droppable id={`delete-task`} data={{ type: 'delete' }}>
          <Button
            src='x'
            className='!rounded-full h-10 w-10 bg-red-900 mr-2 flex-none'
          />
        </Droppable>
      )}
      <div
        className='relative h-10 w-10 flex-none'
        {...attributes}
        {...listeners}
        ref={setNodeRef}
      >
        <Button
          className='h-full w-full cursor-grab !rounded-full bg-accent child:invert'
          src='plus'
        />
      </div>
      {newTask && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-8 space-y-2'>
          <div
            className='flex h-full max-h-[50vh] w-full flex-col space-y-1 overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary p-2 max-w-2xl'
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
                onKeyDown={(ev) =>
                  ev.key === 'Enter' &&
                  getters
                    .getObsidianAPI()
                    .createNewTask(newTask, null, dailyNoteInfo)
                }
              ></input>
              <Button
                src='check'
                onClick={() =>
                  getters
                    .getObsidianAPI()
                    .createNewTask(newTask, null, dailyNoteInfo)
                }
              />
            </div>
            <input
              placeholder='search files...'
              className='w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  getters
                    .getObsidianAPI()
                    .createNewTask(newTask, filteredHeadings[0], dailyNoteInfo)
                }
              }}
            ></input>
            <div className='h-0 w-full grow space-y-1 overflow-y-auto text-sm'>
              {filteredHeadings.map((path) => (
                <NewTaskHeading key={path} path={path} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NewTaskHeading({ path }: { path: string }) {
  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const name = useMemo(
    () => parseHeadingFromPath(path, false, dailyNoteInfo),
    [path]
  )
  const title = useMemo(() => parseHeadingTitle(name), [name])
  const newTask = useAppStore((state) => state.newTask)
  invariant(newTask)

  return (
    <div
      key={path}
      onMouseDown={() => {
        if (path === 'Daily')
          getters.getObsidianAPI().createNewTask(newTask, null, dailyNoteInfo)
        else {
          getters.getObsidianAPI().createNewTask(newTask, path, dailyNoteInfo)
        }
        setTimeout(() => setters.set({ newTask: false }))
      }}
      className={`flex items-center w-full selectable cursor-pointer rounded-lg px-2 hover:underline ${
        name.includes('#') ? 'text-muted pl-4' : 'font-bold text-accent'
      }`}
    >
      <div className='grow'>{title}</div>
      {!path.includes('#') && (
        <div className='text-faint text-xs'>{parseFolderFromPath(path)}</div>
      )}
    </div>
  )
}
