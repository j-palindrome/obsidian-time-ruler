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
import { TaskPriorities, priorityNumberToKey } from '../types/enums'
import moment from 'moment'
import { convertSearchToRegExp, getTasksByHeading } from '../services/util'
import Block from './Block'

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

  const dailyNoteInfo = useAppStore(
    ({ dailyNoteFormat, dailyNotePath }) => ({
      dailyNoteFormat,
      dailyNotePath,
    }),
    shallow
  )
  const fileOrder = useAppStore((state) => state.fileOrder)
  const tasks = useAppStore((state) => state.tasks)
  const tasksByHeading = useMemo(
    () => getTasksByHeading(tasks, dailyNoteInfo, fileOrder),
    [tasks]
  )

  const searchExp = convertSearchToRegExp(search)

  const searchTasks = useMemo(() => {
    const searchTasks: Record<string, string> = {}
    for (let [_heading, tasks] of tasksByHeading) {
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
        _.map(tasksByHeading, '1')
          .flat()
          .map((task) => task.status)
      ),
    ].sort()
  }, [tasksByHeading])

  const searching = !!searchStatus

  const filterTask = (task: TaskProps) =>
    !(status && task.status !== status) &&
    !(searchStatus === 'unscheduled' && task.scheduled) &&
    searchExp.test(searchTasks[task.id])

  const sortByHeading = () => {
    return tasksByHeading.map(([heading, tasks]) => {
      const matchingTasks = _.filter(tasks, (task) => filterTask(task))

      return (
        <div key={heading}>
          {matchingTasks.length > 0 && (
            <Block
              tasks={matchingTasks}
              type='search'
              id={`search::${heading}`}
              dragContainer='search'
            />
          )}
        </div>
      )
    })
  }

  const sortTasksBy = (type: 'due' | 'scheduled') => (
    <>
      {_.sortBy(
        _.filter(tasks, (task) => filterTask(task) && !!task[type]),
        type
      ).map((task) => (
        <Task type='search' id={task.id} dragContainer='search' key={task.id} />
      ))}
    </>
  )

  const tasksByPriority = () => (
    <>
      {_.sortBy(
        _.filter(
          tasks,
          (task) => filterTask(task) && task.priority !== TaskPriorities.DEFAULT
        ),
        'priority'
      ).map((task) => (
        <Task type='search' id={task.id} dragContainer='search' key={task.id} />
      ))}
    </>
  )

  const sortedHeadings = () => {
    return tasksByHeading.map(([heading, tasks]) => {
      const subheadings = _.uniq(_.map(tasks, 'heading')).filter(
        (heading) => heading
      )
      return (
        <>
          {searchExp.test(tasks[0].path) && (
            <Heading
              key={heading}
              path={tasks[0].path}
              isPage={tasks[0].page}
              idString={`search::${heading}`}
            />
          )}
          {subheadings.map((subheading) => {
            const fullSubheadingPath = tasks[0].path + '#' + subheading
            return (
              searchExp.test(fullSubheadingPath) && (
                <Heading
                  key={subheading}
                  path={fullSubheadingPath}
                  isPage={tasks[0].page}
                  idString={`search::${fullSubheadingPath}`}
                />
              )
            )
          })}
        </>
      )
    })
  }

  const displayTasks = () => {
    invariant(searchStatus)
    switch (searchStatus) {
      case 'headings':
        return sortedHeadings()
      case 'all':
      case 'unscheduled':
        return sortByHeading()
      case 'due':
        return sortTasksBy('due')
      case 'scheduled':
        return sortTasksBy('scheduled')
      case 'priority':
        return tasksByPriority()
    }
  }

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
                        const firstHeading = tasksByHeading.find(
                          ([heading, _tasks]) => searchExp.test(heading)
                        )?.[0]
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
                    {[
                      'headings',
                      'all',
                      'unscheduled',
                      'scheduled',
                      'due',
                      'priority',
                    ].map((mode: ViewMode) => (
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
              </div>
              {displayTasks()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
