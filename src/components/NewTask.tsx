import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { useEffect, useRef, useState } from 'react'
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

export default function NewTask({ dragContainer }: { dragContainer: string }) {
  const data: DragData = {
    dragType: 'new_button',
  }
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `new_task_button::${dragContainer}`,
    data,
  })

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

  const checkForClick = () => {
    if (!getters.get('dragData') && !getters.get('newTask')) {
      setters.set({ newTask: { task: { scheduled: undefined }, type: 'new' } })
    }
    window.removeEventListener('mouseup', checkForClick)
  }

  const calendarMode = useAppStore(
    (state) => state.settings.viewMode === 'week'
  )

  const [focus, setFocus] = useState(false)

  useEffect(() => {
    const onFocus = (ev: KeyboardEvent) => {
      if (ev.key === 'Tab') {
        ev.stopPropagation()
        inputRef.current.focus()
      }
    }
    if (focus) {
      window.addEventListener('keydown', onFocus, { capture: true })
    }
    return () => {
      window.removeEventListener('keydown', onFocus)
    }
  }, [focus])

  return (
    <div className={`relative z-30 ${calendarMode ? '' : 'flex pl-2'}`}>
      {draggingTask ? (
        <>
          <Droppable id={`delete-task`} data={{ type: 'delete' }}>
            <Button
              src='x'
              className={`!rounded-full ${
                calendarMode ? 'h-8 w-8 mb-2' : 'h-10 w-10 mr-2'
              } bg-red-900 flex-none`}
            />
          </Droppable>
          {draggingTask.dragType === 'task' && (
            <Droppable id={`move-task`} data={{ type: 'move' }}>
              <Button
                src='move-right'
                className={`!rounded-full ${
                  calendarMode ? 'h-8 w-8' : 'h-10 w-10'
                } bg-blue-900 flex-none`}
              />
            </Droppable>
          )}
        </>
      ) : (
        <>
          <Button
            {...attributes}
            {...listeners}
            onMouseDown={() => {
              window.addEventListener('mouseup', checkForClick)
            }}
            ref={setNodeRef}
            className={`relative flex-none cursor-grab !rounded-full bg-accent child:invert ${
              calendarMode ? 'h-8 w-8' : 'h-10 w-10'
            }`}
            src='plus'
          />
        </>
      )}

      {newTaskData && newTask && newTaskMode && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-8 space-y-2 '>
          <div
            className='flex h-full max-h-[50vh] w-full flex-col space-y-1 overflow-y-auto overflow-x-hidden rounded-icon border border-solid border-faint bg-code p-2 max-w-2xl backdrop-blur'
            ref={frame}
          >
            <div className='flex items-center'>
              <div className='pl-2 font-menu text-lg font-bold mr-2'>
                {newTaskMode === 'new' ? 'New Task' : 'Move Task'}
              </div>
              <div className='text-sm text-faint'>
                {newTask.scheduled ?? 'Unscheduled'}
              </div>
              <div className='grow' />
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
              ref={inputFrame}
              className='w-full rounded-icon border border-solid border-faint bg-transparent font-menu font-light backdrop-blur !text-base px-1 py-2'
              value={newTask.originalTitle ?? ''}
              placeholder='title...'
              onChange={(ev) =>
                setters.set({
                  newTask: {
                    task: { ...newTask, originalTitle: ev.target.value },
                    type: newTaskMode!,
                  },
                })
              }
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              onKeyDown={(ev) => {
                if (ev.key === 'Tab') {
                  ev.preventDefault()
                }
                if (ev.key === 'Enter')
                  getters
                    .getObsidianAPI()
                    .createNewTask(newTask, null, dailyNoteInfo)
              }}
            ></input>

            <input
              placeholder='search files...'
              className='w-full rounded-icon border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={search}
              ref={inputRef}
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
                <NewTaskHeading
                  key={path}
                  headingPath={path}
                  newTaskData={newTaskData}
                />
              ))}
            </div>
          </div>
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
