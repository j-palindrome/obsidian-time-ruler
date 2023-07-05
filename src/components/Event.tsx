import { useDraggable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { setters, useAppStore } from '../app/store'
import { isDateISO } from '../services/util'
import Block from './Block'
import Droppable from './Droppable'
import Times, { TimeSpanTypes } from './Times'
import TimeSpan, { BlockData } from './TimeSpan'
import Logo from './Logo'
import Button from './Button'

export type EventComponentProps = {
  id?: string
  tasks: TaskProps[]
  type?: TimeSpanTypes
  startISO: string
  endISO: string
  displayStartISO: string
  blocks: BlockData[]
}
export default function Event({
  id,
  tasks,
  startISO,
  endISO,
  due,
  displayStartISO,
  blocks,
  type = 'minutes',
  draggable = true
}: EventComponentProps & { draggable?: boolean; due?: boolean }) {
  if (tasks.length === 0) draggable = false
  const thisEvent = useAppStore(state => (id ? state.events[id] : undefined))
  const dragData: DragData = {
    dragType: 'event',
    id,
    tasks,
    type,
    blocks,
    startISO,
    endISO,
    displayStartISO
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id:
        displayStartISO +
        '::event' +
        '::' +
        id +
        tasks.map(x => x.id).join(','),
      data: dragData
    })

  const today = DateTime.now().toISODate() as string
  const formatStart = (date: string) => {
    const isDate = isDateISO(date)
    return DateTime.fromISO(date).toFormat(
      isDate ? 'EEE MMM d' : date < today ? 'EEE MMM d t' : 't'
    )
  }

  const data = due ? { due: displayStartISO } : { scheduled: displayStartISO }

  const titleBar = (
    <div
      className={`group flex h-6 w-full flex-none items-center rounded-lg pr-2 font-menu text-xs ${
        draggable ? 'selectable cursor-grab' : ''
      }`}>
      <Button
        src='plus'
        className='ml-2 mr-1 h-4 w-4 flex-none opacity-0 transition-opacity duration-300 group-hover:opacity-100'
        onClick={() => {
          setters.set({
            searchStatus: due
              ? { due: displayStartISO }
              : { scheduled: displayStartISO }
          })
        }}
      />
      <div
        className='flex w-full items-center'
        {...(draggable
          ? { ref: setActivatorNodeRef, ...attributes, ...listeners }
          : undefined)}>
        {thisEvent && (
          <div
            className={`mr-2 w-fit min-w-[24px] flex-none whitespace-nowrap text-sm`}>
            {thisEvent.title}
          </div>
        )}

        <hr className='w-full border-t border-faint'></hr>

        {!DateTime.fromISO(startISO).equals(
          DateTime.fromISO(displayStartISO)
        ) && (
          <>
            <span className='ml-2 whitespace-nowrap text-faint'>
              {formatStart(displayStartISO)}
            </span>
            <span className='ml-2 text-faint'>&gt;</span>
          </>
        )}
        <span className='ml-2 whitespace-nowrap'>{formatStart(startISO)}</span>
        {!DateTime.fromISO(startISO).diff(DateTime.fromISO(endISO)) && (
          <>
            <span className='ml-2 text-faint'>&gt;</span>
            <span className='ml-2 whitespace-nowrap text-muted'>
              {formatStart(endISO)}
            </span>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={`w-full rounded-lg bg-secondary-alt`}
      ref={draggable ? setNodeRef : undefined}>
      <Droppable data={data} id={startISO}>
        {titleBar}
      </Droppable>

      <Block type='event' {...{ tasks, due, scheduled: displayStartISO }} />
      <TimeSpan
        startISO={displayStartISO}
        endISO={endISO}
        blocks={blocks}
        type={type}
      />

      {thisEvent && (thisEvent.location || thisEvent.notes) && (
        <div className='flex space-x-4 py-2 pl-6 text-xs'>
          <div className='whitespace-nowrap'>{thisEvent.location}</div>
          <div className='max-w-[75%] truncate text-muted'>
            {thisEvent.notes}
          </div>
        </div>
      )}
    </div>
  )
}
