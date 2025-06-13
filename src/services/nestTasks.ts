import _, { uniq } from 'lodash'
import { AppState } from 'src/app/store'

export function nestTasks(
  tasksAndChildren: TaskProps[],
  tasks: AppState['tasks']
) {
  // filter out tasks which are children of other tasks
  const allTasks = uniq(tasksAndChildren)
  const descendants = (taskId: string) =>
    !tasks[taskId]
      ? []
      : [
          ...tasks[taskId].children,
          ...tasks[taskId].children.flatMap((childId) => descendants(childId)),
        ]
  const allDescandants = new Set(
    allTasks.flatMap((task) => descendants(task.id))
  )

  // Tasks that aren't children of any other tasks
  const parentTasks = allTasks.filter((task) => !allDescandants.has(task.id))

  // Process parent tasks to include their children
  const mapChildren = (parent: TaskProps) => {
    // Find all direct children of this parent
    const directChildren = allTasks.filter((task) =>
      parent.children?.some((subtaskId) => subtaskId === task.id)
    )

    return {
      ...parent,
      subtasks: directChildren.map((x) => mapChildren(x)) ?? [],
    }
  }

  return parentTasks.map((task) => mapChildren(task))
}
