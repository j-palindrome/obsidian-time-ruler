import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { act, useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { AppState, getters, setters, useAppStore } from '../app/store'
import {
  convertSearchToRegExp,
  getHeading,
  parseFileFromPath,
  parseFolderFromPath,
  splitHeading,
} from '../services/util'
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
    invariant(frame.current)
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

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const allHeadings: string[] = useAppStore((state) => {
    if (!newTask) return []
    return _.uniq(
      _.flatMap(state.tasks, (task) => {
        if (task.completed || task.page) return []
        return task.path.replace('.md', '')
      }).concat(['Daily'])
    ).sort()
  }, shallow)

  const searchExp = convertSearchToRegExp(search)
  const filteredHeadings = allHeadings.filter((heading) =>
    searchExp.test(heading)
  )

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
      {draggingTask ? (
        <>
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

function NewTaskHeading({
  headingPath,
  newTaskData,
}: {
  headingPath: string
  newTaskData: NonNullable<AppState['newTask']>
}) {
  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const [myContainer, title] = splitHeading(headingPath)
  const newTask = newTaskData.task
  const newTaskType = newTaskData.type

  return (
    <div
      key={headingPath}
      onMouseDown={async () => {
        const api = getters.getObsidianAPI()
        if (newTaskType === 'move') {
          await api.moveTask(newTask as TaskProps, headingPath)
        } else {
          api.createNewTask(newTask, headingPath, dailyNoteInfo)
        }
        setTimeout(() => setters.set({ newTask: null }))
      }}
      className={`flex items-center w-full selectable cursor-pointer rounded-icon px-2 hover:underline ${
        headingPath.includes('#') ? 'text-muted' : 'font-bold text-accent'
      }`}
    >
      <div className='grow mr-2 whitespace-nowrap'>
        {title.slice(0, 30) + (title.length > 30 ? '...' : '')}
      </div>
      <div className='text-faint text-xs whitespace-nowrap text-right'>
        {(myContainer.length > 30 ? '...' : '') +
          myContainer.slice(Math.max(0, myContainer.length - 30))}
      </div>
    </div>
  )
}
