import { DateTime } from 'luxon'
import { setters, useAppStore } from '../app/store'
import { isDateISO } from '../services/util'
import Droppable from './Droppable'
import Editor from './Editor'
import Times, { TimeSpanTypes } from './Times'
import { useDraggable } from '@dnd-kit/core'
import Block from './Block'

export type EventComponentProps = {
  id?: string
  tasks: TaskProps[]
  type?: TimeSpanTypes
  start: string
  end: string
  displayStart: string
}
export default function Event({
  id,
  tasks,
  type = 'minutes',
  start,
  end,
  draggable = true,
  due,
  displayStart
}: EventComponentProps & { draggable?: boolean; due?: boolean }) {
  if (tasks.length === 0) draggable = false
  const allDay =
    (['minutes', 'hours'].includes(type) && isDateISO(start)) ||
    ['days'].includes(type)
  const thisEvent = useAppStore(state => id && state.events[id])
  const dragData: DragData = {
    dragType: 'event',
    id,
    tasks,
    type,
    start,
    end,
    displayStart
  }
  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: displayStart + '::event' + '::' + id + tasks.map(x => x.id).join(','),
      data: dragData
    })

  const today = DateTime.now().toISODate() as string
  const formatStart = (date: string) => {
    const isDate = isDateISO(date)
    return DateTime.fromISO(date).toFormat(
      isDate ? 'EEE MMM d' : date < today ? 'EEE MMM d t' : 't'
    )
  }

  const titleBar = (
    <div
      className={`flex h-6 w-full flex-none items-center rounded-lg pl-6 pr-2 font-menu text-xs ${
        draggable ? 'selectable cursor-grab' : ''
      }`}
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

      {!DateTime.fromISO(start).equals(DateTime.fromISO(displayStart)) && (
        <>
          <span className='ml-2 whitespace-nowrap text-faint'>
            {formatStart(displayStart)}
          </span>
          <span className='ml-2 text-faint'>&gt;</span>
        </>
      )}
      <span className='ml-2 whitespace-nowrap'>{formatStart(start)}</span>
      {!DateTime.fromISO(start).diff(DateTime.fromISO(end)) && (
        <>
          <span className='ml-2 text-faint'>&gt;</span>
          <span className='ml-2 whitespace-nowrap text-muted'>
            {formatStart(end)}
          </span>
        </>
      )}
    </div>
  )

  return (
    <div
      className='w-full rounded-lg bg-primary-alt'
      ref={draggable ? setNodeRef : undefined}>
      <Droppable
        data={due ? { due: displayStart } : { scheduled: displayStart }}
        id={start}>
        {titleBar}
      </Droppable>

      <div className='flex w-full overflow-hidden'>
        <div className='w-full'>
          {tasks.length > 0 && (
            <Block
              tasks={due ? tasks.map(x => ({ ...x, type: 'link' })) : tasks}
              type='event'
              due={due}
            />
          )}
        </div>

        {!allDay && start < end && (
          <div className='w-16 flex-none'>
            <Times
              type={type}
              startISO={start}
              endISO={end}
              chopStart
              chopEnd
              due={due}
            />
          </div>
        )}
      </div>
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
