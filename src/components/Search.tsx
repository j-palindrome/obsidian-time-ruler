import { useDraggable } from '@dnd-kit/core'
import _, { head } from 'lodash'
import { Fragment, useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { Heading } from './Block'
import Button from './Button'
import Toggle from './Toggle'
import Task from './Task'
import Droppable from './Droppable'
import { createTask } from '../services/obsidianApi'

export default function Search() {
  const headings = useAppStore((state) => {
    const headings = _.sortBy(
      _.uniq(
        _.flatMap(state.tasks, (task) => {
          const path = task.path.replace(/\.md$/, '')
          return [path, path + (task.heading ? '#' + task.heading : '')]
        }).concat(state.dailyNote ? [state.dailyNote] : [])
      ),
      (heading) => state.fileOrder.indexOf(heading.replace(/#.*/, ''))
    )
    if (state.dailyNote && headings.includes(state.dailyNote)) {
      headings.splice(headings.indexOf(state.dailyNote), 1)
      headings.splice(0, 0, state.dailyNote)
    }
    return headings
  }, shallow)

  const searchStatus = useAppStore((state) => state.searchStatus)
  const [search, setSearch] = useState('')
  const inputFrame = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLDivElement>(null)

  const activeDrag = useAppStore((state) => state.dragData)
  const hideShowingOnDrag = () => {
    if (activeDrag && searchStatus) {
      setters.set({ searchStatus: false })
    }
  }
  useEffect(hideShowingOnDrag, [activeDrag, searchStatus])

  const checkShowing = (ev: MouseEvent) => {
    invariant(frame.current && button.current)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(frame.current) && !els.includes(button.current)) {
      setters.set({ searchStatus: false })
    }
  }
  useEffect(() => {
    window.removeEventListener('mousedown', checkShowing)
    if (searchStatus) {
      window.addEventListener('mousedown', checkShowing)
      setTimeout(() => inputFrame.current?.focus())
      setSearch('')
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [searchStatus])

  const tasksByHeading = useAppStore(
    (state) =>
      _.mapValues(
        _.groupBy(
          _.filter(state.tasks, (task) => !task.parent),
          (task) =>
            task.path.replace('.md', '') +
            (task.heading ? '#' + task.heading : '')
        ),
        (tasks) => _.sortBy(tasks, 'id')
      ),
    shallow
  )

  const [showingTasks, setShowingTasks] = useState(true)
  const searchExp = new RegExp(_.escapeRegExp(search), 'i')

  type ViewMode = 'all' | 'scheduled' | 'due' | 'unscheduled'
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const testViewMode = (task: TaskProps) => {
    switch (viewMode) {
      case 'all':
        return true
      case 'unscheduled':
        return !task.scheduled
      case 'due':
        return !!task.due
      case 'scheduled':
        return !!task.scheduled
    }
  }

  const searchDiv = () => (
    <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-4'>
      <div
        className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary'
        ref={frame}
      >
        <div className='relative px-4 pb-4'>
          <div className='sticky top-0 z-10 pt-4 backdrop-blur'>
            <div className='flex w-full items-center space-x-2'>
              <h2 className='w-fit'>
                {searchStatus === true ? 'Search' : 'Create Task'}
              </h2>
              <input
                className='sticky top-4 h-6 w-full space-y-2 rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    const firstHeading = headings.find((heading) =>
                      searchExp.test(heading)
                    )
                    if (!firstHeading) return
                    if (searchStatus === true) {
                      ev.preventDefault()
                      app.workspace.openLinkText(firstHeading, '')
                    } else if (searchStatus) {
                      const [path, heading] = firstHeading.split('#')
                      createTask(path + '.md', heading, searchStatus)
                    }
                    setters.set({ searchStatus: false })
                  } else if (ev.key === 'Escape') {
                    setters.set({ searchStatus: false })
                  }
                }}
                placeholder='filter'
                ref={inputFrame}
              ></input>
            </div>
            <div className='space-1 flex flex-wrap'>
              <Toggle
                title={'tasks'}
                callback={(state) => setShowingTasks(state)}
                value={showingTasks}
              />

              <div className='flex grow flex-wrap items-center justify-end'>
                {showingTasks &&
                  ['all', 'scheduled', 'due', 'unscheduled'].map(
                    (mode: ViewMode) => (
                      <Button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`${
                          viewMode === mode
                            ? 'border border-solid border-faint'
                            : ''
                        }`}
                      >
                        {mode}
                      </Button>
                    )
                  )}
              </div>
            </div>
          </div>

          {headings.map((heading) => {
            const filteredTasks = showingTasks
              ? tasksByHeading[heading]?.filter(
                  (task) =>
                    searchExp.test(
                      task.path + '#' + task.heading + task.title
                    ) && testViewMode(task)
                ) ?? []
              : []
            return (
              <Fragment key={heading}>
                {(viewMode === 'all' || filteredTasks.length > 0) && (
                  <div key={heading} className='my-4'>
                    {searchExp.test(heading) && (
                      <DraggableHeading
                        dragData={
                          searchStatus === true
                            ? {
                                dragType: 'group',
                                tasks: tasksByHeading[heading],
                                hidePaths: [],
                                name: heading,
                                level: heading.includes('#')
                                  ? 'heading'
                                  : 'group',
                                type: 'search',
                                id: heading,
                                dragContainer: 'search',
                              }
                            : { dragType: 'new', path: heading }
                        }
                        path={heading}
                      />
                    )}

                    {showingTasks &&
                      filteredTasks.map((task) => (
                        <Task
                          id={task.id}
                          key={task.id}
                          type='search'
                          dragContainer={'search'}
                        />
                      ))}
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Button
        onClick={() => {
          setters.set({ searchStatus: true })
          setSearch('')
        }}
        ref={button}
        src={'search'}
      />
      {searchStatus && searchDiv()}
    </>
  )
}

function DraggableHeading({
  dragData,
  path,
}: {
  dragData: DragData
  path: string
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } =
    useDraggable({
      id: `${path}::search`,
      data: dragData,
    })

  return (
    <div ref={setNodeRef}>
      <Heading
        dragProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef }}
        path={path}
      />
    </div>
  )
}
