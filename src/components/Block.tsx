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
import { COLLAPSE_UNSCHEDULED } from './Unscheduled'

export type BlockComponentProps = BlockProps & {
  hidePaths?: string[]
  type: BlockType
  id?: string
  dragContainer: string
  parentId?: string
  dragging?: true
}

export const UNGROUPED = '__ungrouped'
export type BlockType = 'event' | 'unscheduled' | 'child' | 'all-day'
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
  let showingTasks = useAppStore((state) => {
    const children = _.flatMap(tasks, (task) => getChildren(task, state.tasks))
    return tasks.filter((task) => !children.includes(task.id))
  }, shallow)

  const topLevel = _.sortBy(showingTasks, 'id')

  const groupedTasks = useAppStore((state) => {
    return _.groupBy(topLevel, (task) =>
      getHeading(task, state.dailyNoteInfo, state.settings.groupBy, hidePaths)
    )
  })

  const sortedGroups = useAppStore((state) => {
    switch (state.settings.groupBy) {
      case 'priority':
        return _.sortBy(
          _.entries(groupedTasks),
          ([group]) => (group === UNGROUPED ? 0 : 1),
          0
        )
      case 'path':
        return _.sortBy(
          _.entries(groupedTasks),
          ([group, _tasks]) => (group === UNGROUPED ? 0 : 1),
          ([group, _tasks]) =>
            state.fileOrder.indexOf(parseFileFromPath(group)),
          '1.0.position.start.line'
        )
      case 'hybrid':
        return _.sortBy(
          _.entries(groupedTasks),
          ([group, _tasks]) => (group === UNGROUPED ? 0 : 1),
          '1.0.priority',
          ([group, _tasks]) =>
            state.fileOrder.indexOf(parseFileFromPath(group)),
          '1.0.position.start.line'
        )
      case false:
        return _.entries(groupedTasks)
    }
  }, shallow)

  const expanded = useAppStore(
    (state) =>
      _.sum(
        sortedGroups
          .filter(([group]) => group !== UNGROUPED)
          .map(([group]) => (state.collapsed[group] ? 0 : 1))
      ) > 0
  )

  const dragData: DragData = {
    dragType: 'block',
    hidePaths,
    tasks: showingTasks,
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

  const hideTimes = useAppStore((state) => state.settings.hideTimes)
  const draggable = tasks.length > 0

  const onlyPath: string | undefined =
    events.length === 0 &&
    type === 'event' &&
    sortedGroups.length === 1 &&
    sortedGroups[0][0] !== UNGROUPED
      ? sortedGroups[0][0]
      : undefined
  const onlyPathTitle = onlyPath ? splitHeading(onlyPath)[1] : undefined

  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const firstEndISO = blocks[0]?.startISO || endISO
  const firstStartISO =
    showingPastDates || !startISO
      ? startISO
      : _.max([startISO, toISO(roundMinutes(DateTime.now()))])

  const collapseButton = () => (
    <div className='w-indent flex-none px-1'>
      <Button
        className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none'
        src={expanded ? 'chevron-down' : 'chevron-right'}
        onClick={() => {
          setters.patchCollapsed(
            _.map(sortedGroups, 0).filter((x) => x !== UNGROUPED),
            expanded
          )
          return false
        }}
        onPointerDown={() => false}
      />
    </div>
  )

  const collapsed = useAppStore((state) =>
    type === 'unscheduled'
      ? _.sum(
          sortedGroups.map(([title]) => (state.collapsed[title] ? 1 : 0))
        ) === sortedGroups.length
      : false
  )

  const [unscheduledPortal, setUnscheduledPortal] =
    useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (type === 'unscheduled') {
      setUnscheduledPortal(
        document.getElementById(COLLAPSE_UNSCHEDULED) as HTMLDivElement
      )
    }
  }, [])

  return (
    <>
      {type === 'unscheduled' &&
        unscheduledPortal &&
        createPortal(
          <Button
            className='flex-none w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            src={collapsed ? 'chevron-right' : 'chevron-down'}
            onClick={() => {
              setters.patchCollapsed(_.map(sortedGroups, 0), !collapsed)
              return false
            }}
          />,
          unscheduledPortal
        )}
      <div
        id={id}
        data-role='block'
        className={`relative w-full rounded-icon ${
          ['event', 'unscheduled', 'all-day'].includes(type)
            ? 'bg-code pb-2'
            : ''
        } `}
        ref={draggable ? setNodeRef : undefined}
      >
        {(type === 'event' || type === 'all-day') && (
          <Droppable
            data={{ scheduled: startISO ?? '' }}
            id={`${dragContainer}::${type}::${startISO}::${
              tasks[0]?.id ?? events?.[0]?.id
            }`}
          >
            <div
              className={`selectable flex rounded-icon font-menu text-xs w-full py-0.5 group`}
            >
              {collapseButton()}

              <div className='w-full flex'>
                <div className={`w-fit flex-none max-w-[80%] mr-2`}>
                  {onlyPathTitle && (
                    <div>
                      {onlyPathTitle.slice(0, 40) +
                        (onlyPathTitle.length > 40 ? '...' : '')}
                    </div>
                  )}
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
            {sortedGroups.map(([path, tasks]) => (
              <Group
                key={path}
                {...{
                  headingPath: path,
                  tasks,
                  type,
                  hidePaths: onlyPath ? [...hidePaths, onlyPath] : hidePaths,
                  dragContainer: `${dragContainer}::${startISO}`,
                  startISO,
                }}
              />
            ))}
          </div>
          {firstStartISO && firstEndISO && firstStartISO < firstEndISO && (
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
