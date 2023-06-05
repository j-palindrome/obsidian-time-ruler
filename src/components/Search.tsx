import _ from 'lodash'
import { useAppStore } from '../app/store'
import { shallow } from 'zustand/shallow'
import { Heading, HeadingProps } from './Block'
import Logo from './Logo'
import { useEffect, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import $ from 'jquery'
import { useDraggable } from '@dnd-kit/core'
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

  const [showing, setShowing] = useState(false)
  const [search, setSearch] = useState('')
  const inputFrame = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLDivElement>(null)

  const activeDrag = useAppStore(state => state.dragData)
  const hideShowingOnDrag = () => {
    if (activeDrag && showing) {
      setShowing(false)
    }
  }
  useEffect(hideShowingOnDrag, [activeDrag, showing])

  const filteredHeadings = headings.filter(heading =>
    new RegExp(search, 'i').test(heading)
  )

  const checkShowing = (ev: MouseEvent) => {
    invariant(frame.current && button.current)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)

    if (!els.includes(frame.current) && !els.includes(button.current)) {
      setShowing(false)
    }
  }

  useEffect(() => {
    if (showing) {
      window.addEventListener('mousedown', checkShowing)
      setTimeout(() => inputFrame.current?.focus())
    } else {
      window.removeEventListener('mousedown', checkShowing)
    }
    return () => window.removeEventListener('mousedown', checkShowing)
  }, [showing])

  return (
    <div className='group relative z-30 flex h-full w-fit flex-none items-center'>
      <Button
        onClick={() => {
          setShowing(!showing)
          setSearch('')
        }}
        ref={button}
        src={'search'}
      />

      {showing && (
        <div
          className='obsidian-border absolute left-[1px] top-full max-h-[50vh]  min-w-[200px] overflow-y-auto overflow-x-hidden rounded-lg bg-primary'
          ref={frame}>
          <div className=' p-4'>
            <input
              className='sticky top-4 w-full rounded-lg border border-solid border-faint bg-transparent p-1 font-menu backdrop-blur'
              value={search}
              onChange={ev => setSearch(ev.target.value)}
              onKeyDown={ev => {
                if (ev.key === 'Enter') {
                  ev.preventDefault()
                  if (!filteredHeadings[0]) return
                  app.workspace.openLinkText(filteredHeadings[0], '')
                  setShowing(false)
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
      )}
    </div>
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
