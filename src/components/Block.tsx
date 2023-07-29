import _ from 'lodash'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../app/store'
import Group from './Group'

const UNGROUPED = '__ungrouped'
export type BlockType = 'child' | 'time' | 'event' | 'default' | 'search'
export default function Block({
  hidePaths = [],
  tasks,
  type,
  id,
  dragContainer,
}: {
  hidePaths?: string[]
  tasks: TaskProps[]
  type: BlockType
  id?: string
  dragContainer: string
}) {
  const tasksByParent = ['parent', 'child'].includes(type)
    ? { undefined: tasks }
    : _.groupBy(tasks, 'parent')

  const taskIds = _.map(tasks, 'id')
  const nestedTasks = useAppStore((state) =>
    _.entries(tasksByParent).flatMap(([parentID, children]) => {
      if (parentID === 'undefined') return children
      else {
        const parentAlreadyIncludedInList = taskIds.includes(parentID)
        if (parentAlreadyIncludedInList) return []
        const parentTask = state.tasks[parentID]
        return {
          ...parentTask,
          children: children.map((x) => x.id),
          type: 'parent',
        } as TaskProps
      }
    })
  )

  const sortedTasks = _.sortBy(nestedTasks, 'position.start.line')
  const groupedTasks = _.groupBy(sortedTasks, 'path')
  const sortedGroups = useAppStore(
    (state) =>
      _.sortBy(_.entries(groupedTasks), ([group, _tasks]) =>
        state.fileOrder.indexOf(group)
      ),
    shallow
  )

  const blockId = tasks[0]?.scheduled ?? ''

  return (
    <div
      id={id}
      data-role='block'
      className={`w-full ${type === 'event' ? 'pb-2 pl-2' : ''}`}
    >
      {sortedGroups.map(([name, tasks]) => (
        <Group
          key={tasks[0].id}
          level='group'
          {...{ name, tasks, type, hidePaths, id: blockId, dragContainer }}
        />
      ))}
    </div>
  )
}
