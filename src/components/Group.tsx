import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import {
  getHeading,
  getParents,
  parseFileFromPath,
  splitHeading,
} from 'src/services/util'
import { setters, useAppStore } from '../app/store'
import { BlockType } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Task from './Task'
import {
  TaskPriorities,
  priorityKeyToNumber,
  simplePriorityToNumber,
} from 'src/types/enums'

const UNGROUPED = '__ungrouped'

export type GroupComponentProps = {
  hidePaths: string[]
  headingPath: string
  tasks: TaskProps[]
  type: BlockType
  dragContainer: string
  startISO?: string
}

export default function Group({
  headingPath,
  tasks,
  type,
  hidePaths,
  dragContainer,
  startISO,
}: GroupComponentProps) {
  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    headingPath: headingPath,
    hidePaths,
    dragContainer,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${headingPath}::${dragContainer}::${type}`,
      data: dragData,
    })

  const [container, heading] = splitHeading(headingPath)
  let formattedContainer = container.slice(
    container.includes('/') ? container.lastIndexOf('/') + 1 : 0
  )
  if (formattedContainer.length > 25)
    formattedContainer = formattedContainer.slice(0, 25) + '...'
  formattedContainer = formattedContainer.replace('.md', '')

  const collapsed = useAppStore(
    (state) => state.collapsed[headingPath] ?? false
  )

  const dragging = useAppStore(
    (state) =>
      state.dragData &&
      state.dragData.dragType === 'group' &&
      !_.keys(simplePriorityToNumber).includes(heading) &&
      parseFileFromPath(state.dragData.headingPath) !==
        parseFileFromPath(headingPath)
  )

  const sortedTasks =
    type === 'upcoming'
      ? _.sortBy(tasks, 'due', 'priority')
      : _.sortBy(
          tasks,
          'path',
          'position.start.line'
          // 'priority',
          // (task) => (task.due ? `0::${task.due}` : '1')
        )

  const isPriority = _.keys(simplePriorityToNumber).includes(heading)

  return (
    <div
      ref={!isPriority ? setNodeRef : undefined}
      className={`w-full overflow-hidden time-ruler-group`}
      data-id={`${headingPath}::${dragContainer}::${type}`}
    >
      {headingPath &&
        headingPath !== UNGROUPED &&
        !hidePaths.includes(headingPath) && (
          <>
            {dragging ? (
              <Droppable
                data={{
                  type: 'heading',
                  heading: headingPath,
                }}
                id={`${dragContainer}::${headingPath}::droppable`}
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
                  className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none cursor-pointer'
                  src={collapsed ? 'chevron-right' : 'chevron-down'}
                  onClick={() => {
                    setters.patchCollapsed([headingPath], !collapsed)
                    return false
                  }}
                  onPointerDown={() => false}
                />
              </div>

              <div
                className={`w-full flex items-center ${
                  !isPriority ? 'cursor-grab' : ''
                }`}
                {...(!isPriority
                  ? { ...attributes, ...listeners, ref: setActivatorNodeRef }
                  : undefined)}
              >
                <div className={`w-fit flex-none max-w-[50%] text-normal`}>
                  {heading.slice(0, 40) + (heading.length > 40 ? '...' : '')}
                </div>
                <hr className='border-t border-t-faint opacity-50 mx-2 h-0 my-0 w-full'></hr>
                {container && !hidePaths.includes(container) && (
                  <div className='w-fit flex-none text-right pr-2'>
                    {formattedContainer}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      {!collapsed &&
        sortedTasks.map((task) => (
          <Task
            key={task.id}
            dragContainer={dragContainer}
            {...task}
            startISO={startISO}
          />
        ))}
    </div>
  )
}
