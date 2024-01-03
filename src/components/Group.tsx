import { useDraggable } from '@dnd-kit/core'
import { useMemo } from 'react'
import {
  parseFileFromPath,
  parseFolderFromPath,
  parseHeadingFromPath,
  formatHeadingTitle,
  getParents,
} from 'src/services/util'
import { setters, useAppStore } from '../app/store'
import { BlockType } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Task, { TaskComponentProps } from './Task'
import _ from 'lodash'
import {
  TaskPriorities,
  priorityNumberToKey,
  priorityNumberToSimplePriority,
} from 'src/types/enums'

const UNGROUPED = '__ungrouped'

export type GroupComponentProps = {
  hidePaths: string[]
  path: string
  tasks: TaskProps[]
  type: BlockType
  dragContainer: string
}

export default function Group({
  path,
  tasks,
  type,
  hidePaths,
  dragContainer,
}: GroupComponentProps) {
  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    path,
    hidePaths,
    dragContainer,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${path}::${dragContainer}::${type}`,
      data: dragData,
    })

  const [heading, container] = useAppStore((state) =>
    formatHeadingTitle(
      path,
      state.settings.groupBy,
      state.dailyNoteInfo,
      !tasks[0] ? false : getParents(tasks[0], state.tasks).last()?.page
    )
  )

  const collapsed = useAppStore((state) => state.collapsed[path] ?? false)

  const dragging = useAppStore(
    (state) =>
      state.settings.groupBy === 'path' &&
      state.dragData &&
      state.dragData.dragType === 'group' &&
      parseFileFromPath(state.dragData.path) !== heading
  )

  return (
    <div
      ref={setNodeRef}
      className={`w-full overflow-hidden time-ruler-group`}
      data-id={`${path}::${dragContainer}::${type}`}
    >
      {path && path !== UNGROUPED && !hidePaths.includes(path) && (
        <>
          {dragging ? (
            <Droppable
              data={{
                type: 'heading',
                heading: parseFileFromPath(path),
              }}
              id={`${dragContainer}::${path}::droppable`}
            >
              <div className='h-2 w-full rounded-icon'></div>
            </Droppable>
          ) : (
            <div className='h-2 w-full rounded-icon'></div>
          )}
          <div
            className={`selectable flex rounded-icon font-menu text-xs group w-full`}
          >
            <div className='w-indent flex-none px-1'>
              <Button
                className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none'
                src={collapsed ? 'chevron-right' : 'chevron-down'}
                onClick={() => {
                  setters.patchCollapsed([path], !collapsed)
                  return false
                }}
                onPointerDown={() => false}
              />
            </div>

            <div
              className='w-full flex items-center cursor-grab'
              {...attributes}
              {...listeners}
              ref={setActivatorNodeRef}
            >
              <div className={`w-fit flex-none max-w-[50%] text-normal`}>
                {heading.slice(0, 40) + (heading.length > 40 ? '...' : '')}
              </div>
              <hr className='border-t border-t-faint opacity-50 mx-2 h-0 my-0 w-full'></hr>
              {container && !hidePaths.includes(container) && (
                <div className='w-fit flex-none text-right pr-2'>
                  {(
                    container.slice(0, 25) +
                    (container.length > 25 ? '...' : '')
                  ).replace('.md', '')}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!collapsed &&
        _.sortBy(
          tasks,
          (task) => parseFileFromPath(task.path),
          'position.start.line'
        ).map((task) => (
          <Task key={task.id} dragContainer={dragContainer} {...task} />
        ))}
    </div>
  )
}
