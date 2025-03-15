import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import {
  getHeading,
  getParents,
  getSubHeading,
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

  const [myContainer, heading] = splitHeading(headingPath)
  let formattedContainer = myContainer.slice(
    myContainer.includes('/') ? myContainer.lastIndexOf('/') + 1 : 0
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

  const groupBySetting = useAppStore((state) => state.settings.groupBy)
  const groupedTasks = _.groupBy(tasks, (task) => {
    if (type === 'upcoming') return UNGROUPED
    return getSubHeading(task, groupBySetting, hidePaths)
  })

  const sortedTasks = _.sortBy(Object.entries(groupedTasks), 0).map(
    ([heading, tasks]) =>
      [
        heading,
        type === 'upcoming'
          ? _.sortBy(tasks, 'due', 'priority')
          : _.sortBy(
              tasks,
              'path',
              'position.start.line'
              // 'priority',
              // (task) => (task.due ? `0::${task.due}` : '1')
            ),
      ] as [string, TaskProps[]]
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
                <div
                  className={`w-fit flex-none max-w-[50%] text-normal truncate`}
                >
                  {heading}
                </div>
                <hr className='border-t border-t-faint opacity-50 mx-2 h-0 my-0 w-full'></hr>
                {myContainer && !hidePaths.includes(myContainer) && (
                  <div className='w-fit flex-none text-right pr-2'>
                    {formattedContainer}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      {!collapsed && (
        <>
          {sortedTasks
            .find(([heading]) => heading === UNGROUPED)?.[1]
            .map((task) => (
              <Task
                dragContainer={dragContainer}
                key={task.path + task.id}
                startISO={startISO}
                {...task}
              />
            ))}
          {sortedTasks
            .filter(([heading]) => heading !== UNGROUPED)
            .map(([heading, tasks]) => {
              return (
                <Group
                  key={heading}
                  headingPath={heading}
                  dragContainer={dragContainer}
                  hidePaths={[...hidePaths, headingPath]}
                  tasks={tasks}
                  type={type}
                ></Group>
              )
            })}
        </>
      )}
    </div>
  )
}
