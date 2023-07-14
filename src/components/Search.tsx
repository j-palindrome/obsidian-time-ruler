import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { Heading } from './Block'
import Button from './Button'
import Toggle from './Toggle'
import Task from './Task'
import Droppable from './Droppable'

export default function Search() {
  const headings = useAppStore(state => {
    const headings = _.sortBy(
      _.uniq(
        _.flatMap(state.tasks, task => {
          const path = task.path.replace(/\.md$/, '')
          return [path, path + (task.heading ? '#' + task.heading : '')]
        }).concat(state.dailyNote ? [state.dailyNote] : [])
      ),
      heading =>
        `${state.fileOrder.indexOf(heading.replace(/#.*/, ''))}${
          heading.match(/#.*/)?.[0] ?? ''
        }`
    )
    if (state.dailyNote && headings.includes(state.dailyNote)) {
      headings.splice(headings.indexOf(state.dailyNote), 1)
      headings.splice(0, 0, state.dailyNote)
    }
    return headings
  }, shallow)

  const searchStatus = useAppStore(state => state.searchStatus)
  const [search, setSearch] = useState('')
  const inputFrame = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLDivElement>(null)

  const activeDrag = useAppStore(state => state.dragData)
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
    state =>
      _.mapValues(
        _.groupBy(
          state.tasks,
          task =>
            task.path.replace('.md', '') +
            (task.heading ? '#' + task.heading : '')
        ),
        tasks => _.sortBy(tasks, 'id')
      ),
    shallow
  )

  const [showingTasks, setShowingTasks] = useState(true)
  const searchExp = new RegExp(_.escapeRegExp(search), 'i')

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
      {searchStatus && (
        <div className='fixed left-0 top-0 z-40 flex h-full w-full items-center justify-center p-4'>
          <div
            className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-faint bg-primary'
            ref={frame}>
            <div className='p-4'>
              <h2>{searchStatus === true ? 'Search' : 'Create Task'}</h2>
              <div className='flex w-full items-center'>
                <input
                  className='sticky top-4 w-full space-y-2 rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
                  value={search}
                  onChange={ev => setSearch(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter') {
                      const firstHeading = headings.find(heading =>
                        searchExp.test(heading)
                      )
                      if (!firstHeading) return
                      if (searchStatus === true) {
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
                  placeholder='filter'
                  ref={inputFrame}></input>
                <Toggle
                  title={'tasks'}
                  callback={state => setShowingTasks(state)}
                  value={showingTasks}
                />
              </div>

              {headings.map(heading => (
                <div key={heading}>
                  {searchExp.test(heading) && (
                    <DraggableHeading
                      dragData={{ dragType: 'new', path: heading }}
                      path={heading}
                    />
                  )}
                  {showingTasks &&
                    tasksByHeading[heading]
                      ?.filter(task => searchExp.test(task.title))
                      .map(task => (
                        <Task id={task.id} key={task.id} type='link' />
                      ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DraggableHeading({
  dragData,
  path
}: {
  dragData: DragData
  path: string
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } =
    useDraggable({
      id: path + '::new',
      data: dragData
    })

  return (
    <div ref={setNodeRef}>
      <Heading
        dragProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef }}
        path={path}
        noPadding
      />
    </div>
  )
}
