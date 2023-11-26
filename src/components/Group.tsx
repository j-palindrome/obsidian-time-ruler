import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { BlockType } from './Block'
import Droppable from './Droppable'
import Heading from './Heading'
import Task from './Task'
import { parseFileFromPath, parseHeadingFromPath } from '../services/util'
import { getDailyNoteInfo } from 'src/services/obsidianApi'
import { useAppStore } from '../app/store'
import { shallow } from 'zustand/shallow'

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
  hidePaths,
  id,
  dragContainer,
}: GroupProps) {
  const dailyNoteInfo = useAppStore(
    ({ dailyNoteFormat, dailyNotePath }) => ({
      dailyNoteFormat,
      dailyNotePath,
    }),
    shallow
  )
  const groupedHeadings =
    level === 'group'
      ? _.groupBy(tasks, (task) =>
          task.path.includes('#')
            ? parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
            : UNGROUPED
        )
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
    name: parseFileFromPath(name),
    hidePaths,
    id,
    dragContainer,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${id}::${tasks[0].path}::${dragContainer}::${type}`,
      data: dragData,
    })

  return (
    <div ref={setNodeRef} className={`w-full`}>
      {name && name !== UNGROUPED && !hidePaths.includes(name) && (
        <>
          <Heading
            dragProps={{
              ...attributes,
              ...listeners,
              ref: setActivatorNodeRef,
            }}
            path={name}
            isPage={tasks[0].page}
            idString={`${id}::${name}::${
              dragData.type
            }::${level}::${dragData.tasks.map((x) => x.id).join(':')}::reorder`}
          />
        </>
      )}

      {level === 'group'
        ? sortedHeadings.map(([headingName, tasks]) => (
            <Group
              level='heading'
              key={headingName}
              {...{
                tasks,
                name: headingName,
                type,
                due,
                hidePaths: hidePaths.concat([name]),
                id,
                dragContainer,
              }}
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
