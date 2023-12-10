import _ from 'lodash'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../app/store'
import { parseFileFromPath, parseHeadingFromPath } from '../services/util'
import Group from './Group'
import { TaskComponentProps } from './Task'

export const UNGROUPED = '__ungrouped'
export type BlockType =
  | 'child'
  | 'time'
  | 'event'
  | 'default'
  | 'search'
  | 'unscheduled'
export default function Block({
  hidePaths = [],
  tasks,
  type,
  id,
  dragContainer,
  startISO,
}: {
  hidePaths?: string[]
  tasks: TaskComponentProps[]
  type: BlockType
  id?: string
  dragContainer: string
  startISO: string | undefined
}) {
  // const tasksByParent = ['parent', 'child'].includes(type)
  //   ? { undefined: tasks }
  //   : _.groupBy(tasks, 'parent')

  // const taskIds = _.flatMap(tasks, (task) => [task.id, ...task.children])

  // add in parent tasks which aren't included (to be "parent" type dummy tasks of children)
  // const nestedTasks = useAppStore((state) =>
  //   _.entries(tasksByParent).flatMap(([parentID, children]) => {
  //     if (parentID === 'undefined') return children
  //     else {
  //       const parentAlreadyIncludedInList = taskIds.includes(parentID)
  //       if (parentAlreadyIncludedInList) return []
  //       const parentTask = state.tasks[parentID]
  //       return {
  //         ...parentTask,

  //         type: 'parent',
  //       } as TaskProps
  //     }
  //   })
  // )

  const sortedTasks = _.sortBy(tasks, [
    'task.priority',
    'task.path',
    'task.position.start.line',
  ])

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const groupedTasks = _.groupBy(sortedTasks, (task) => {
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

  const blockId = startISO ?? 'unscheduled'
  return (
    <div
      id={id}
      data-role='block'
      className={`w-full ${type === 'event' ? 'pb-2' : ''}`}
    >
      {sortedGroups.map(([name, tasks]) => (
        <Group
          key={tasks[0].task.id}
          level='group'
          {...{
            path: name,
            tasks,
            type,
            hidePaths,
            id: blockId,
            dragContainer,
            startISO,
          }}
        />
      ))}
    </div>
  )
}
