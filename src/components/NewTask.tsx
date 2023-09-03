import { useDraggable } from '@dnd-kit/core'
import Button from './Button'
import { getters, setters, useAppStore } from '../app/store'
import { useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import moment from 'moment'
import {
  convertSearchToRegExp,
  getDailyNotePath,
  getTasksByHeading,
  parseHeadingFromPath,
} from '../services/util'
import { shallow } from 'zustand/shallow'

export default function NewTask() {
  const data: DragData = {
    dragType: 'new_button',
  }
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'new_task_button',
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

  const headings = useAppStore(
    (state) => Object.keys(getTasksByHeading(state.tasks)).sort(),
    shallow
  )

  const [search, setSearch] = useState('')
  const searchExp = convertSearchToRegExp(search)

  return (
    <>
      <div className='h-8 w-8' {...attributes} {...listeners} ref={setNodeRef}>
        <Button
          className='h-full w-full cursor-grab rounded-full bg-accent child:invert'
          src='plus'
        />
      </div>
      {newTask && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-8'>
          <div
            className='flex h-full max-h-[50vh] w-full flex-col space-y-1 overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary p-2'
            ref={frame}
          >
            <h1 className='pl-2 font-menu text-lg font-bold'>New Task</h1>
            <input
              ref={inputFrame}
              className='h-6 w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={newTask.originalTitle ?? ''}
              placeholder='title...'
              onChange={(ev) =>
                setters.set({
                  newTask: { ...newTask, originalTitle: ev.target.value },
                })
              }
            ></input>
            <input
              placeholder='search files...'
              className='h-6 w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            ></input>
            <div className='h-0 w-full grow space-y-1 overflow-y-auto px-2'>
              {headings
                .filter((heading) => searchExp.test(heading))
                .map((heading) => {
                  const { name, level } = parseHeadingFromPath(heading)
                  return (
                    <div
                      key={heading}
                      onMouseDown={() => {
                        const [path, splitHeading] = heading.split('#')
                        getters
                          .getObsidianAPI()
                          .createTask(path, splitHeading, newTask)

                        setTimeout(() => setters.set({ newTask: false }))
                      }}
                      className={`selectable cursor-pointer hover:underline ${
                        level === 'heading'
                          ? 'text-muted'
                          : 'font-bold text-accent'
                      }`}
                    >
                      {name}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
