import _ from 'lodash'

export function nestTasks(tasksAndChildren: TaskProps[]) {
  // filter out tasks which are children of other tasks
  const allTasks = [...tasksAndChildren]
  const subtaskIds = new Set(
    _.flatMap(
      allTasks,
      (task) => task.subtasks?.map((subtask) => subtask.id) || []
    )
  )

  // Tasks that aren't children of any other tasks
  const parentTasks = allTasks.filter((task) => !subtaskIds.has(task.id))

  // Process parent tasks to include their children
  const mapChildren = (parent) => {
    // Find all direct children of this parent
    const directChildren = allTasks.filter((task) =>
      parent.children?.some((subtask) => subtask.id === task.id)
    )

    return {
      ...parent,
      subtasks: directChildren.map((x) => mapChildren(x)) ?? [],
    }
  }

  return parentTasks.map((task) => mapChildren(task))
}
