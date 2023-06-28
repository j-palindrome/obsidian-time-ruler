import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { Heading } from './Block'
import Button from './Button'

export default function Search() {
  const headings = useAppStore(
    state =>
      _.uniq(
        _.flatMap(state.tasks, task => {
          const path = task.path.replace(/\.md$/, '')
          return [path, path + (task.heading ? '#' + task.heading : '')]
        })
      ).sort(),
    shallow
  )

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

  const filteredHeadings = headings.filter(heading =>
    new RegExp(_.escapeRegExp(search), 'i').test(heading)
  )

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
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [searchStatus])

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
          {/* <div
            className='absolute left-0 top-0 -z-10 h-full w-full'
            onClick={() => setters.set({ searchStatus: false })}></div> */}
          <div
            className='h-full w-full overflow-y-auto overflow-x-hidden rounded-lg border border-solid border-normal bg-primary'
            ref={frame}>
            <div className='p-4'>
              <h2>{searchStatus === true ? 'Search' : 'Create Task'}</h2>
              <input
                className='sticky top-4 w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
                value={search}
                onChange={ev => setSearch(ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    if (searchStatus === true) {
                      ev.preventDefault()
                      if (!filteredHeadings[0]) return
                      app.workspace.openLinkText(filteredHeadings[0], '')
                    } else if (searchStatus) {
                      const [path, heading] = filteredHeadings[0].split('#')
                      getters
                        .getObsidianAPI()
                        .createTask(path + '.md', heading, searchStatus)
                    }
                    setters.set({ searchStatus: false })
                  }
                }}
                placeholder='filter'
                ref={inputFrame}></input>
              {filteredHeadings.map(heading => (
                <DraggableHeading
                  key={heading}
                  dragData={{ dragType: 'new', path: heading }}
                  path={heading}
                />
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
