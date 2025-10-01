import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TaskPriorities, priorityNumberToKey } from 'src/types/enums'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import {
  getChildren,
  getHeading,
  isDateISO,
  parseFileFromPath,
  roundMinutes,
  splitHeading,
  toISO,
} from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Group from './Group'
import Hours from './Hours'
import Minutes from './Minutes'

export type BlockComponentProps = BlockProps & {
  hidePaths?: string[]
  type: BlockType
  id?: string
  dragContainer: string
  parentId?: string
  dragging?: true
}

export const UNGROUPED = '__ungrouped'
export type BlockType = 'event' | 'child' | 'all-day' | 'upcoming' | 'starred'
export type BlockProps = {
  startISO?: string
  endISO?: string
  tasks: TaskProps[]
  events: EventProps[]
  blocks: BlockProps[]
  title?: string
}

export default function Block({
  hidePaths = [],
  tasks,
  type,
  id,
  dragContainer,
  startISO,
  endISO,
  parentId,
  events,
  dragging,
  blocks,
  title,
}: BlockComponentProps) {
  const topLevel = _.sortBy(tasks, 'id')
  const groupedTasks = useAppStore((state) => {
    return _.groupBy(topLevel, (task) =>
      getHeading(
        task,
        state.dailyNoteInfo,
        type === 'upcoming' ? false : state.settings.groupBy,
        hidePaths,
        true
      )
    )
  })

  const sortedGroups = useAppStore((state) => {
    switch (state.settings.groupBy) {
      case false:
        return _.entries(groupedTasks)
      default:
        return _.sortBy(
          _.entries(groupedTasks),
          ([group]) => (group === UNGROUPED ? 0 : 1),
          '1.0.priority',
          ([group, _tasks]) => {
            return state.fileOrder.indexOf(parseFileFromPath(group))
          },
          '1.0.position.start.line'
        )
    }
  }, shallow)

  const dragData: DragData = {
    dragType: 'block',
    hidePaths,
    tasks,
    type,
    id,
    dragContainer,
    startISO,
    endISO,
    blocks: [],
    parentId,
    events,
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

  const hideTimes = useAppStore(
    (state) => state.settings.hideTimes || state.settings.viewMode === 'week'
  )
  const draggable = tasks.length > 0

  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const firstEndISO = blocks[0]?.startISO || endISO
  const firstStartISO =
    showingPastDates || !startISO
      ? startISO
      : _.max([startISO, toISO(roundMinutes(DateTime.now()))])

  const collapsed = useAppStore((state) => {
    if (sortedGroups.length === 0) return false
    for (let heading of sortedGroups) {
      if (!state.collapsed[heading[0]]) return false
    }
    return true
  })

  return (
    <>
      <div
        id={id}
        data-role='block'
        className={`relative w-full rounded-icon ${
          type !== 'child' ? 'bg-code pb-2' : ''
        } ${type === 'event' ? 'mt-1' : ''}`}
        ref={draggable ? setNodeRef : undefined}
      >
        {!['child', 'unscheduled'].includes(type) && (
          <Droppable
            data={{ scheduled: startISO ?? '' }}
            id={`${dragContainer}::${type}::${startISO}::${
              tasks[0]?.id ?? events?.[0]?.id
            }`}
          >
            <div
              className={`selectable flex rounded-icon font-menu text-xs w-full py-0.5 group`}
            >
              <div className='w-indent flex-none px-1'>
                <Button
                  className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none'
                  src={!collapsed ? 'chevron-down' : 'chevron-right'}
                  onClick={() => {
                    setters.patchCollapsed(
                      sortedGroups.map((x) => x[0]),
                      !collapsed
                    )
                    return false
                  }}
                  onPointerDown={() => false}
                />
              </div>

              <div className='w-full flex'>
                <div className={`w-fit flex-none max-w-[80%] mr-2`}>
                  {events.map(({ title, id }) => (
                    <div key={id}>
                      {title.slice(0, 40) + (title.length > 40 ? '...' : '')}
                    </div>
                  ))}
                </div>

                <div
                  className='w-full flex items-center cursor-grab pr-2'
                  {...attributes}
                  {...listeners}
                  ref={setActivatorNodeRef}
                >
                  <hr className='border-t border-t-faint opacity-50 h-0 my-0 w-full'></hr>
                  {startISO && (
                    <span className='ml-2 whitespace-nowrap flex-none'>
                      {title ?? formatStart(startISO)}
                    </span>
                  )}
                  {hideTimes &&
                    startISO &&
                    endISO &&
                    !isDateISO(startISO) &&
                    DateTime.fromISO(startISO).diff(
                      DateTime.fromISO(endISO)
                    ) && (
                      <>
                        <span className='ml-2 text-faint flex-none'>&gt;</span>
                        <span className='ml-2 whitespace-nowrap text-muted flex-none'>
                          {formatStart(endISO)}
                        </span>
                      </>
                    )}
                </div>
              </div>
            </div>
          </Droppable>
        )}
        <div className='flex relative w-full'>
          <div
            className={`time-ruler-groups w-full relative z-10 h-fit ${
              type === 'event' ? 'pt-1 pl-1 pb-1' : ''
            }`}
          >
            {sortedGroups.map(([path, tasks]) => {
              return (
                <Group
                  key={path}
                  isOnly={sortedGroups.length === 1}
                  {...{
                    headingPath: path,
                    tasks,
                    type,
                    hidePaths,
                    dragContainer: `${dragContainer}::${startISO}`,
                    startISO,
                  }}
                />
              )
            })}
          </div>
          {!hideTimes &&
            firstStartISO &&
            firstEndISO &&
            firstStartISO < firstEndISO && (
              <div className='w-10 flex-none'>
                <Minutes
                  startISO={firstStartISO}
                  endISO={firstEndISO}
                  dragContainer={dragContainer}
                  chopStart
                  chopEnd
                />
              </div>
            )}
        </div>
        {events[0] && (events[0].location || events[0].notes) && (
          <div className='py-2 pl-indent text-xs'>
            <div className='w-full truncate'>{events[0].location}</div>
            <div className='w-full truncate text-muted'>{events[0].notes}</div>
          </div>
        )}

        {blocks.length > 0 && blocks[0].startISO && endISO && (
          <Hours {...{ endISO, blocks }} startISO={blocks[0].startISO} />
        )}
      </div>
    </>
  )
}
