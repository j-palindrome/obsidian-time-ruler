import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { openTask } from 'src/services/obsidianApi'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import {
  assembleSubtasks,
  isDateISO,
  parseFileFromPath,
  parseHeadingFromPath,
  useCollapsed,
} from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Group from './Group'
import Hours from './Hours'
import { TaskComponentProps } from './Task'

export type BlockComponentProps = {
  hidePaths?: string[]
  titles: {
    title: string
    id: string
  }[]
  tasks: TaskComponentProps[]
  type: BlockType
  id?: string
  dragContainer: string
  parentId?: string
  dragging?: true
  startISO?: string
  endISO?: string
  blocks: BlockProps[]
}

export const UNGROUPED = '__ungrouped'
export type BlockType = 'child' | 'event' | 'unscheduled'
export type BlockProps = {
  startISO?: string
  endISO?: string
  tasks: TaskProps[]
  events: EventProps[]
  blocks: BlockProps[]
}

export default function Block({
  hidePaths = [],
  type,
  id,
  dragContainer,
  parentId,
  tasks,
  events,
  startISO,
  endISO,
  blocks,
}: Omit<BlockComponentProps, 'tasks' | 'titles'> & BlockProps) {
  let allTasks = [...tasks]

  const queryParents: TaskComponentProps[] = allTasks
    .filter((task) => task.query && (!task.parent || task.parent === parentId))
    .map((task): TaskComponentProps => {
      const queryChildren = allTasks.filter(
        (queriedTask) => queriedTask.queryParent === task.id
      )
      const queryAncestors = queryChildren.flatMap((child) =>
        assembleSubtasks(child, allTasks)
      )
      return {
        task,
        subtasks: queryChildren.concat(queryAncestors),
        dragContainer,
        type: 'query',
      }
    })

  allTasks = _.difference(
    allTasks,
    queryParents.flatMap((x) => [x.task, ...x.subtasks])
  )

  let unscheduledParents: TaskProps[] = useAppStore((state) => {
    if (type === 'child') return []
    const taskIds = _.map(allTasks, 'id')
    const unscheduledParents: TaskProps[] = []
    for (let task of allTasks) {
      if (task.parent && !taskIds.includes(task.parent)) {
        taskIds.push(task.parent)
        unscheduledParents.push(state.tasks[task.parent])
      }
    }
    return unscheduledParents
  }, shallow)

  const parents: TaskComponentProps[] = allTasks
    .filter(
      (task) =>
        !task.parent ||
        task.parent === parentId ||
        (task.queryParent && task.queryParent === parentId)
    )
    .concat(unscheduledParents)
    .map((task) => {
      return {
        task,
        subtasks: assembleSubtasks(task, allTasks),
        dragContainer,
        type: unscheduledParents.includes(task) ? 'parent' : 'task',
      }
    })

  const topLevel = _.sortBy(queryParents.concat(parents), 'task.id')

  const titles: BlockComponentProps['titles'] = (events ?? []).map((event) => ({
    title: event.title,
    id: event.id,
  }))

  return (
    <DraggableBlock
      tasks={topLevel}
      {...{
        titles,
        hidePaths,
        startISO,
        endISO,
        type,
        id,
        dragContainer,
        parentId,
        blocks,
      }}
    />
  )
}

export function DraggableBlock({
  hidePaths = [],
  tasks,
  type,
  id,
  dragContainer,
  startISO,
  endISO,
  parentId,
  titles,
  dragging,
  blocks,
}: BlockComponentProps) {
  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const groupedTasks = _.groupBy(tasks, (task) => {
    const heading = parseHeadingFromPath(
      task.task.path,
      task.task.page,
      dailyNoteInfo
    )
    if (hidePaths.includes(heading)) return UNGROUPED
    return heading
  })

  const sortedGroups = useAppStore(
    (state) =>
      _.sortBy(_.entries(groupedTasks), [
        ([group, _tasks]) => state.fileOrder.indexOf(parseFileFromPath(group)),
        (group) => (group.includes('#') ? '1' : '0'),
        '1.0.id',
      ]),
    shallow
  )

  const { collapsed, allHeadings } = useCollapsed(tasks.map((x) => x.task))

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
    titles,
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

  const calendarMode = useAppStore((state) => state.viewMode === 'week')
  const draggable = tasks.length > 0

  return (
    <div
      id={id}
      data-role='block'
      data-info={hidePaths}
      className={`w-full rounded-lg px-1 ${
        dragging
          ? 'opacity-50 ancestor:!bg-transparent'
          : ['event', 'unscheduled'].includes(type)
          ? 'bg-secondary-alt'
          : ''
      } ${type === 'event' ? 'py-1' : ''}`}
      ref={draggable ? setNodeRef : undefined}
    >
      {type === 'event' && (
        <Droppable
          data={{ scheduled: startISO ?? '' }}
          id={`${dragContainer}::${type}::${startISO}::${tasks[0]?.task.id}::${titles?.[0]?.id}`}
        >
          <div
            className={`selectable flex rounded-lg font-menu text-xs group w-full`}
          >
            <div className='w-indent flex-none px-1'>
              <Button
                className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none'
                src={collapsed ? 'chevron-right' : 'chevron-down'}
                onClick={() => {
                  setters.patchCollapsed(allHeadings, !collapsed)
                  return false
                }}
                onPointerDown={() => false}
              />
            </div>

            <div className='w-full flex'>
              {titles.length > 0 && (
                <div className={`w-fit flex-none max-w-[80%] mr-2`}>
                  {titles.map(({ title, id }) => (
                    <div key={id}>
                      {title.slice(0, 40) + (title.length > 40 ? '...' : '')}
                    </div>
                  ))}
                </div>
              )}
              <div
                className='w-full flex items-center cursor-grab pr-2'
                {...attributes}
                {...listeners}
                ref={setActivatorNodeRef}
              >
                <hr className='border-t border-t-faint opacity-50 h-0 my-0 w-full'></hr>
                {startISO && (
                  <span className='ml-2 whitespace-nowrap flex-none'>
                    {formatStart(startISO)}
                  </span>
                )}
                {calendarMode &&
                  startISO &&
                  endISO &&
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
          </div>
        </Droppable>
      )}

      {sortedGroups.map(([path, tasks]) => (
        <Group
          key={tasks[0].task.id}
          {...{
            path,
            tasks,
            type,
            hidePaths,
            dragContainer: `${dragContainer}::${startISO}`,
          }}
        />
      ))}
      {startISO && endISO && (startISO < endISO || blocks.length > 0) && (
        <Hours {...{ startISO, endISO, blocks }} type='minutes' chopStart />
      )}
    </div>
  )
}
