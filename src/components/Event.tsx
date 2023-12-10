import { useDraggable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { setters, useAppStore } from '../app/store'
import {
  isDateISO,
  parseHeadingFromPath,
  useCollapsed,
  roundMinutes,
  toISO,
} from '../services/util'
import Block from './Block'
import Droppable from './Droppable'
import Minutes, { NowTime, TimeSpanTypes } from './Minutes'
import Hours from './Hours'
import Logo from './Logo'
import Button from './Button'
import $ from 'jquery'
import { memo, useEffect, useState } from 'react'
import useStateRef from 'react-usestateref'
import _ from 'lodash'

export type EventComponentProps = {
  id?: string
  tasks: TaskProps[]
  type?: TimeSpanTypes
  startISO: string
  endISO: string
  nestedBlocks: BlockData[]
}

const Event = memo(_Event, _.isEqual)
export default Event

function _Event({
  id,
  tasks,
  startISO,
  endISO,
  due,
  nestedBlocks,
  type = 'minutes',
  draggable = true,
  isDragging = false,
  dragContainer = '',
  noExtension = false,
}: EventComponentProps & {
  draggable?: boolean
  due?: boolean
  isDragging?: boolean
  dragContainer?: string
  noExtension?: boolean
}) {
  if (tasks.length === 0) draggable = false
  const thisEvent = useAppStore((state) => (id ? state.events[id] : undefined))
  const dragData: DragData = {
    dragType: 'event',
    id,
    tasks,
    type,
    nestedBlocks: nestedBlocks,
    startISO,
    endISO,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${id}::${startISO}::${type}::${dragContainer}`,
      data: dragData,
    })

  const twentyFourHourFormat = useAppStore(
    (state) => state.settings.twentyFourHourFormat
  )

  const formatStart = (date: string) => {
    const isDate = isDateISO(date)
    return isDate
      ? 'all day'
      : DateTime.fromISO(date).toFormat(twentyFourHourFormat ? 'T' : 't')
  }

  const data = due ? { due: startISO } : { scheduled: startISO }

  const eventWidth = isDragging
    ? $('#time-ruler-times').children()[0]?.getBoundingClientRect().width - 16
    : undefined

  const calendarMode = useAppStore((state) => state.viewMode === 'week')

  const { collapsed, allHeadings } = useCollapsed(tasks)

  const titleBar = (
    <div
      className={`time-ruler-block group flex h-6 w-full flex-none items-center rounded-lg pr-2 font-menu text-xs group ${
        draggable ? 'selectable cursor-grab' : ''
      }`}
    >
      <Button
        className='opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-6 h-4 mx-1 py-0.5 flex-none'
        src={collapsed ? 'chevron-right' : 'chevron-down'}
        onClick={() => {
          setters.patchCollapsed(allHeadings, !collapsed)
        }}
      />
      <div
        className='flex w-full items-center'
        {...(draggable
          ? { ref: setActivatorNodeRef, ...attributes, ...listeners }
          : undefined)}
      >
        {thisEvent && (
          <div
            className={`mr-2 w-fit min-w-[24px] max-w-[60%] overflow-ellipsis flex-none text-sm whitespace-nowrap`}
          >
            {thisEvent.title.slice(0, 40) +
              (thisEvent.title.length > 40 ? '...' : '')}
          </div>
        )}

        <hr className='my-0 w-0 grow border-t border-faint'></hr>

        <span className='ml-2 whitespace-nowrap flex-none'>
          {formatStart(startISO)}
        </span>
        {calendarMode &&
          !isDateISO(startISO) &&
          DateTime.fromISO(startISO).diff(DateTime.fromISO(endISO)) && (
            <>
              <span className='ml-2 text-faint flex-none'>&gt;</span>
              <span className='ml-2 whitespace-nowrap text-muted flex-none'>
                {formatStart(endISO)}
              </span>
            </>
          )}
      </div>
    </div>
  )

  return (
    <div
      className={`w-full rounded-lg pl-1 ${
        isDragging ? 'bg-gray-500/5 opacity-50' : 'bg-secondary-alt'
      }`}
      style={{
        minWidth: eventWidth,
      }}
      ref={draggable ? setNodeRef : undefined}
    >
      <Droppable
        data={data}
        id={startISO + '::event' + '::' + id + tasks.map((x) => x.id).join(',')}
      >
        {titleBar}
      </Droppable>

      <Block
        type='event'
        {...{ tasks, startISO }}
        dragContainer={dragContainer + '::' + startISO}
      />

      {!calendarMode && (
        <Hours
          startISO={startISO}
          endISO={endISO}
          blocks={nestedBlocks}
          type={type}
          chopStart={true}
          dragContainer={dragContainer + '::' + startISO}
          noExtension={noExtension}
        />
      )}

      {thisEvent && (thisEvent.location || thisEvent.notes) && (
        <div className='py-2 pl-6 text-xs'>
          <div className='w-full truncate'>{thisEvent.location}</div>
          <div className='w-full truncate text-muted'>{thisEvent.notes}</div>
        </div>
      )}
    </div>
  )
}
