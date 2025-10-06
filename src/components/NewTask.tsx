import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { act, useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { AppState, getters, setters, useAppStore } from '../app/store'
import Button from './Button'
import Droppable from './Droppable'
import { TaskActions } from 'src/types/enums'

export default function NewTask({ dragContainer }: { dragContainer: string }) {
  const newTaskData = useAppStore((state) => state.newTask)
  const newTask = newTaskData ? newTaskData.task : false

  const newTaskMode = newTaskData ? newTaskData.type : undefined
  const frame = useRef<HTMLDivElement>(null)
  const inputFrame = useRef<HTMLInputElement>(null!)
  const inputRef = useRef<HTMLInputElement>(null!)

  const checkShowing = (ev: MouseEvent) => {
    if (!frame.current) return
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(frame.current)) {
      setters.set({ newTask: null })
    }
  }

  const dragData = useAppStore((state) => state.dragData)

  useEffect(() => {
    window.removeEventListener('mousedown', checkShowing)
    if (newTask) {
      window.addEventListener('mousedown', checkShowing)
      setTimeout(() => inputFrame.current?.focus())
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [!!newTask])

  const [search, setSearch] = useState('')

  useEffect(() => {
    setSearch('')
  }, [newTask])

  const draggingTask = useAppStore((state) =>
    state.dragData &&
    ['task', 'group', 'block'].includes(state.dragData.dragType)
      ? state.dragData
      : undefined
  )

  const calendarMode = useAppStore(
    (state) => state.settings.viewMode === 'week'
  )

  return (
    <div
      className={`relative z-30 ${
        calendarMode ? '' : 'flex pl-2 h-10 items-center'
      }`}
    >
      {dragData?.dragType === 'new-task' ? (
        <>
          <Droppable
            id={`unschedule-task`}
            data={{ scheduled: TaskActions.DELETE }}
          >
            <Button
              src='calendar-x'
              className={`!rounded-full ${
                calendarMode ? 'h-8 w-8' : 'h-10 w-10'
              } bg-accent flex-none child:invert`}
            />
          </Droppable>
        </>
      ) : draggingTask ? (
        <>
          <Droppable id='starred' data={{ type: 'starred' }}>
            <Button
              src='star'
              className={`!rounded-full ${
                calendarMode ? 'h-8 w-8 mb-2' : 'h-6 w-6 mr-2'
              } bg-yellow-900 flex-none`}
              title='Starred'
            ></Button>
          </Droppable>
          <Droppable
            id={`unschedule-task`}
            data={{ scheduled: TaskActions.DELETE }}
          >
            <Button
              src='calendar-x'
              className={`!rounded-full ${
                calendarMode ? 'h-8 w-8 mb-2' : 'h-6 w-6 mr-2'
              } bg-red-900 flex-none`}
            />
          </Droppable>
          <Droppable id={`delete-task`} data={{ type: 'delete' }}>
            <Button
              src='x'
              className={`!rounded-full ${
                calendarMode ? 'h-8 w-8 mb-2' : 'h-6 w-6 mr-2'
              } bg-red-900 flex-none`}
            />
          </Droppable>
          {draggingTask.dragType === 'task' && (
            <Droppable id={`move-task`} data={{ type: 'move' }}>
              <Button
                src='move-right'
                className={`!rounded-full ${
                  calendarMode ? 'h-8 w-8' : 'h-6 w-6'
                } bg-blue-900 flex-none`}
              />
            </Droppable>
          )}
        </>
      ) : (
        <div>
          <Button
            onClick={() => setters.set({ searchStatus: true })}
            className={`relative flex-none cursor-grab !rounded-full bg-accent child:invert ${
              calendarMode ? 'h-8 w-8' : 'h-10 w-10'
            }`}
            src='search'
          />
        </div>
      )}
    </div>
  )
}
