import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { ViewMode, getters, setters, useAppStore } from '../app/store'
import { convertSearchToRegExp, useCollapseAll } from '../services/util'
import {
  TaskPriorities,
  priorityNumberToKey,
  priorityNumberToSimplePriority,
} from '../types/enums'
import Block, { UNGROUPED } from './Block'
import Button from './Button'
import Scroller from './Scroller'
import Task from './Task'
import useStateRef from 'react-usestateref'
import Group from './Group'

export default function Search() {
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

  const tasks = useAppStore((state) => _.values(state.tasks))
  const searchExp = convertSearchToRegExp(search)

  const searchTasks = useMemo(() => {
    const searchTasks: Record<string, string> = {}
    for (let task of tasks) {
      const searchString =
        'path: ' +
          task.path +
          ' title: ' +
          task.title +
          (task.tags.length > 0
            ? ' tag: ' + task.tags.map((tag) => '#' + tag).join(', ')
            : '') +
          ' priority: ' +
          priorityNumberToKey[task.priority] +
          ' completion: ' +
          task.completion ?? ''
      searchTasks[task.id] = searchString
    }
    return searchTasks
  }, [tasks])

  const [showCompletionWithinWeeks, setShowCompletionWithinWeeks] = useState<
    [number, number]
  >([-1, 0])

  useEffect(() => {
    const searchWithinWeeks = getters.get('searchWithinWeeks')
    if (showCompletionWithinWeeks[0] < searchWithinWeeks[0]) {
      setters.set({
        searchWithinWeeks: [showCompletionWithinWeeks[0], searchWithinWeeks[1]],
      })
      getters.getObsidianAPI().loadTasks('')
    }
  }, [showCompletionWithinWeeks])

  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const isCurrent = showCompletionWithinWeeks[1] === 0
  const testTask = (task: TaskProps) => {
    if (task.completed && !showCompleted && searchStatus !== 'completed')
      return false
    const startDate = DateTime.now()
      .plus({ weeks: showCompletionWithinWeeks[0] })
      .startOf('week')
      .toISODate()
    const endDate = DateTime.fromISO(startDate)
      .plus({ weeks: 1 })
      .toISODate() as string
    switch (searchStatus) {
      case 'all':
        return true
      case 'due':
        return task.due
      case 'scheduled':
        return task.scheduled
      case 'priority':
        return task.priority !== TaskPriorities.DEFAULT
      case 'unscheduled':
        return !task.scheduled
      case 'completed':
        const dateKey = task.completion ?? task.scheduled ?? task.due
        return (
          task.completed &&
          (dateKey ? dateKey >= startDate && dateKey <= endDate : isCurrent)
        )
    }
  }

  const filteredTasks = tasks.filter(
    (task) => searchExp.test(searchTasks[task.id]) && testTask(task)
  )

  const [status, setStatus] = useState<string | null>(null)

  const allStatuses = useMemo(() => {
    return [...new Set(tasks.map((task) => task.status))].sort()
  }, [tasks])

  const searching = !!searchStatus

  const { lastCollapseAll, setLastCollapseAll, collapseAll } = useCollapseAll()

  const sortByHeading = (unscheduled?: boolean) => {
    return (
      <Block
        tasks={
          unscheduled
            ? filteredTasks.filter((task) => !task.scheduled)
            : filteredTasks
        }
        type='search'
        id={`search`}
        dragContainer='search'
        startISO={undefined}
        collapseAll={collapseAll}
      />
    )
  }

  const sortTasksBy = (
    type: 'due' | 'scheduled' | 'priority' | 'completion'
  ) => {
    const sort = _.sortBy(
      _.entries(
        _.groupBy(filteredTasks, (task) =>
          type === 'priority'
            ? task.priority
            : (type === 'completion'
                ? task.completion ?? task.scheduled ?? task.due
                : task[type]
              )?.slice(0, 10) ?? UNGROUPED
        )
      ),
      0
    )

    if (type === 'completion') sort.reverse()
    return (
      <>
        {sort.map(([title, tasks]) => (
          <Fragment key={title}>
            <div className='pl-8 mt-2'>
              {title === UNGROUPED
                ? 'Ungrouped'
                : type === 'priority'
                ? priorityNumberToSimplePriority[title]
                : DateTime.fromISO(title).toFormat('EEE, MMM d')}
            </div>
            <hr className='border-t border-t-selection ml-8 mr-2 mt-1 mb-0 h-0'></hr>
            <Block
              collapseAll={collapseAll}
              startISO={undefined}
              dragContainer='search'
              type='search'
              hidePaths={[]}
              {...{ tasks }}
            />
          </Fragment>
        ))}
      </>
    )
  }

  const displayTasks = () => {
    invariant(searchStatus)
    switch (searchStatus) {
      case 'all':
        return sortByHeading()
      case 'unscheduled':
        return sortByHeading(true)
      case 'due':
        return sortTasksBy('due')
      case 'scheduled':
        return sortTasksBy('scheduled')
      case 'priority':
        return sortTasksBy('priority')
      case 'completed':
        return sortTasksBy('completion')
    }
  }

  const viewModes: ViewMode[] = [
    'all',
    'unscheduled',
    'scheduled',
    'due',
    'priority',
    'completed',
  ]

  return (
    <>
      {searching && (
        <div className='fixed left-0 top-0 z-40 !mx-0 flex h-full w-full items-center justify-center p-4'>
          <div
            className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary max-w-2xl'
            ref={frame}
          >
            <div className='relative px-4 pb-4'>
              <div className='sticky top-0 z-10 pt-4 backdrop-blur'>
                <div className='flex w-full items-center space-x-2'>
                  <h2 className='my-2 w-fit'>Search</h2>
                  <input
                    className='sticky top-4 h-6 w-full space-y-2 rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
                    value={search}
                    onChange={(ev) => setSearch(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        const firstHeading = filteredTasks[0]?.path
                        if (!firstHeading) return
                        if (typeof searchStatus === 'string') {
                          ev.preventDefault()
                          app.workspace.openLinkText(firstHeading, '')
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

                <div className='space-1 -mt-1 flex flex-wrap'>
                  <div className='grow'></div>
                  <div className='mt-1 flex flex-wrap items-center pl-2'>
                    {viewModes.map((mode: ViewMode) => (
                      <Button
                        key={mode}
                        onClick={() => setters.set({ searchStatus: mode })}
                        className={`${
                          searchStatus === mode
                            ? 'border border-solid border-faint'
                            : ''
                        }`}
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                </div>
                {searchStatus === 'completed' && (
                  <div className='flex'>
                    <Scroller
                      items={_.range(1, 12).map((x) => `${x}`)}
                      onSelect={(item) => {
                        const weeks = parseInt(item)
                        setShowCompletionWithinWeeks([
                          weeks * -1,
                          weeks * -1 + 1,
                        ])
                      }}
                    />
                    <span>weeks</span>
                  </div>
                )}
              </div>
              {displayTasks()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
