import { useDraggable } from '@dnd-kit/core'
import _, { head } from 'lodash'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { ViewMode, getters, setters, useAppStore } from '../app/store'
import Button from './Button'
import Toggle from './Toggle'
import Task from './Task'
import Droppable from './Droppable'
import Heading from './Heading'
import { priorityNumberToKey } from '../types/enums'

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
    if (state.dailyNote) {
      let i = 0
      for (let heading of headings.filter(
        (heading) => state.dailyNote && heading.startsWith(state.dailyNote)
      )) {
        headings.splice(headings.indexOf(heading), 1)
        headings.splice(i, 0, heading)
        i++
      }
    }
    return headings
  }, shallow)

  const searchStatus = useAppStore((state) => state.searchStatus)
  const [search, setSearch] = useState('')
  useEffect(() => {
    searchStatus === 'all' && setSearch('')
  }, [searchStatus])

  const inputFrame = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  const activeDrag = useAppStore((state) => state.dragData)
  const hideShowingOnDrag = () => {
    if (activeDrag && searchStatus) {
      setters.set({ searchStatus: false })
    }
  }
  useEffect(hideShowingOnDrag, [activeDrag, searchStatus])

  const checkShowing = (ev: MouseEvent) => {
    invariant(frame.current)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(frame.current)) {
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
  let isShowingTasks = typeof searchStatus !== 'string' ? false : showingTasks

  const searchExp = new RegExp(
    search
      .split(' ')
      .map((word) => _.escapeRegExp(word))
      .join('.*'),
    'i'
  )

  const testViewMode = (task: TaskProps) => {
    switch (searchStatus) {
      case 'all':
        return true
      case 'unscheduled':
        return !task.scheduled
      case 'due':
        return !!task.due
      case 'scheduled':
        return !!task.scheduled
      default:
        return true
    }
  }

  const searchTasks = useMemo(() => {
    const searchTasks: Record<string, string> = {}
    for (let [_heading, tasks] of _.entries(tasksByHeading)) {
      for (let task of tasks) {
        const searchString =
          'path: ' +
          task.path +
          ' heading: # ' +
          task.heading +
          ' title: ' +
          task.title +
          (task.tags.length > 0
            ? ' tag: ' + task.tags.map((tag) => '#' + tag).join(', ')
            : '') +
          ' priority: ' +
          priorityNumberToKey[task.priority]
        searchTasks[task.id] = searchString
      }
    }
    return searchTasks
  }, [tasksByHeading])

  const [status, setStatus] = useState<string | null>(null)

  const allStatuses = useMemo(() => {
    return [
      ...new Set(
        Object.values(tasksByHeading)
          .flat()
          .map((task) => task.status)
      ),
    ].sort()
  }, [tasksByHeading])

  const searching = !!searchStatus

  return (
    <>
      {searching && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-4'>
          <div
            className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary'
            ref={frame}
          >
            <div className='relative px-4 pb-4'>
              <div className='sticky top-0 z-10 pt-4 backdrop-blur'>
                <div className='flex w-full items-center space-x-2'>
                  <h2 className='my-2 w-fit'>
                    {typeof searchStatus === 'string'
                      ? 'Search'
                      : 'Create Task'}
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
                        if (typeof searchStatus === 'string') {
                          ev.preventDefault()
                          app.workspace.openLinkText(firstHeading, '')
                        } else if (searchStatus) {
                          const [path, heading] = firstHeading.split('#')
                          getters
                            .getObsidianAPI()
                            .createTask(path + '.md', heading, searchStatus)
                        }
                        setters.set({ searchStatus: false })
                      } else if (ev.key === 'Escape') {
                        setters.set({ searchStatus: false })
                      }
                    }}
                    placeholder='path: heading: title: tag: priority:'
                    ref={inputFrame}
                  ></input>
                  {allStatuses.length > 1 && (
                    <div className='group relative h-fit flex-none'>
                      <Button className='clickable-icon'>
                        {status === ' ' ? '[ ]' : status ?? 'status'}
                      </Button>
                      <div className='absolute right-0 top-full z-30 hidden rounded-lg border-solid border-faint bg-primary group-hover:block'>
                        <Button
                          className='clickable-icon w-full'
                          onClick={() => setStatus(null)}
                        >
                          clear
                        </Button>
                        {allStatuses.map((status) => (
                          <Button
                            key={status}
                            className='clickable-icon h-line w-full'
                            onClick={() => setStatus(status)}
                          >
                            {status === ' ' ? '[ ]' : status}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {typeof searchStatus === 'string' && (
                  <div className='space-1 -mt-1 flex flex-wrap'>
                    <div className='mt-1'>
                      <Toggle
                        title={'tasks'}
                        callback={(state) => setShowingTasks(state)}
                        value={showingTasks}
                      />
                    </div>
                    <div className='grow'></div>
                    <div className='mt-1 flex flex-wrap items-center pl-2'>
                      {isShowingTasks &&
                        ['all', 'scheduled', 'due', 'unscheduled'].map(
                          (mode: ViewMode) => (
                            <Button
                              key={mode}
                              onClick={() =>
                                setters.set({ searchStatus: mode })
                              }
                              className={`${
                                searchStatus === mode
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
                )}
              </div>

              {headings.map((heading) => {
                const filteredTasks = isShowingTasks
                  ? tasksByHeading[heading]?.filter(
                      (task) =>
                        !(status && task.status !== status) &&
                        searchExp.test(searchTasks[task.id]) &&
                        testViewMode(task)
                    ) ?? []
                  : []
                const [path, section] = heading.split('#')
                const headingMatch = searchExp.test(
                  `path: ${path} ${section ? `heading: #${section}` : ''}`
                )
                return (
                  <Fragment key={heading}>
                    {((searchStatus === 'all' && !status) ||
                      !isShowingTasks ||
                      filteredTasks.length > 0) && (
                      <div key={heading} className='my-4'>
                        {headingMatch && (
                          <DraggableHeading
                            dragData={
                              typeof searchStatus === 'string'
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

                        {isShowingTasks &&
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
      )}
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
