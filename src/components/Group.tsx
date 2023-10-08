import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { BlockType } from './Block'
import Droppable from './Droppable'
import Heading from './Heading'
import Task from './Task'

const UNGROUPED = '__ungrouped'

export type GroupProps = {
  hidePaths: string[]
  name: string
  tasks: TaskProps[]
  type: BlockType
  level: 'group' | 'heading'
  due?: boolean
  id: string
  dragContainer: string
}

export default function Group({
  name,
  tasks,
  type,
  level,
  due,
  hidePaths: hidePaths,
  id,
  dragContainer,
}: GroupProps) {
  const groupedHeadings =
    level === 'group'
      ? _.groupBy(tasks, (task) => task.heading ?? UNGROUPED)
      : []
  const sortedHeadings =
    level === 'group'
      ? _.sortBy(_.entries(groupedHeadings), [
          ([name, _tasks]) => (name === UNGROUPED ? 0 : 1),
          '1.0.path',
          '1.0.position.start.line',
        ])
      : []

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    level,
    name,
    hidePaths,
    id,
    dragContainer,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${id}::${tasks[0].path}${
        level === 'heading' ? '::' + tasks[0].heading : ''
      }::${dragContainer}::${type}`,
      data: dragData,
    })

  return (
    <div ref={setNodeRef} className={`w-full`}>
      {type !== 'child' &&
        name &&
        name !== UNGROUPED &&
        !hidePaths.includes(name) && (
          <>
            <Heading
              dragProps={{
                ...attributes,
                ...listeners,
                ref: setActivatorNodeRef,
              }}
              path={
                tasks[0].path +
                (level === 'heading' ? '#' + tasks[0].heading : '')
              }
              isPage={tasks[0].page}
              idString={`${id}::${name}::${
                dragData.type
              }::${level}::${dragData.tasks
                .map((x) => x.id)
                .join(':')}::reorder`}
            />
          </>
        )}

      {level === 'group'
        ? sortedHeadings.map(([name, tasks]) => (
            <Group
              level='heading'
              key={name}
              {...{ tasks, name, type, due, hidePaths, id, dragContainer }}
            />
          ))
        : tasks.map((task, i) => (
            <Task
              dragContainer={dragContainer}
              key={task.id}
              id={task.id}
              type={task.type}
              children={task.children}
            />
          ))}
    </div>
  )
}
