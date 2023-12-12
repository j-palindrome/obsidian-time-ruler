import { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { getters, setters } from 'src/app/store'
import { isTaskProps } from 'src/types/enums'
import { DateTime, Duration } from 'luxon'
import { useAppStoreRef } from '../app/store'
import _ from 'lodash'
import {
  assembleSubtasks,
  roundMinutes,
  toISO,
  isDateISO,
  findScheduledInParents,
} from './util'
import invariant from 'tiny-invariant'

export const onDragEnd = async (
  ev: DragEndEvent,
  activeDragRef: React.RefObject<DragData | null>
) => {
  const dropData = ev.over?.data.current as DropData | undefined
  const dragData = activeDragRef.current

  if (ev.active.id === ev.over?.id) {
    setters.set({ dragData: null })
    return
  }

  const getChildren = () => {
    let children: string[] = []
    invariant(dragData)
    const tasks = _.values(getters.get('tasks'))
    switch (dragData.dragType) {
      case 'block':
      case 'group':
        children = dragData.tasks
          .filter((x) => !x.task.queryParent)
          .flatMap((parent) =>
            assembleSubtasks(parent.task, tasks).concat(parent.task)
          )
          .map((child) => child.id)
        break
      case 'task':
        children = assembleSubtasks(dragData.task, tasks)
          .map((x) => x.id)
          .concat(dragData.task.id)
        break
    }
    return children.sort()
  }

  if (dragData?.dragType === 'new_button' && !dropData) {
    setters.set({ newTask: { scheduled: undefined } })
  } else if (dropData && dragData) {
    if (!isTaskProps(dropData)) {
      switch (dropData.type) {
        case 'heading':
          if (dragData.dragType !== 'group') break
          setters.updateFileOrder(dragData.path, dropData.heading)
          break
        case 'delete':
          let children = getChildren()

          if (children.length > 1) {
            if (!confirm(`Delete ${children.length} tasks and children?`)) break
          }

          for (let id of children.reverse()) {
            await getters.getObsidianAPI().deleteTask(id)
          }

          break
      }
    } else {
      switch (dragData.dragType) {
        case 'now':
          if (!dropData.scheduled) break

          const dayStart = getters.get('settings').dayStartEnd[0]
          const startOfDay = DateTime.now()
            .startOf('day')
            .plus({ hours: dayStart })
          const today = toISO(startOfDay)
          const tomorrow = toISO(startOfDay.plus({ days: 1 }))
          const tasks = getters.get('tasks')
          const futureTasks: Record<string, TaskProps[]> = {}

          for (let task of _.values(tasks)) {
            if (task.completed) continue
            const scheduled = findScheduledInParents(task.id, tasks, false)
            if (
              scheduled &&
              !isDateISO(scheduled) &&
              scheduled >= today &&
              scheduled < tomorrow
            ) {
              if (task.queryParent) continue
              let parent = task.parent
              while (parent) {
                if (tasks[parent].queryParent) continue
                parent = tasks[parent].parent
              }
              if (futureTasks[scheduled]) futureTasks[scheduled].push(task)
              else futureTasks[scheduled] = [task]
            }
          }

          const tasksByTime = _.sortBy(_.entries(futureTasks), 0)
          const { hours: shiftHours, minutes: shiftMinutes } = DateTime.fromISO(
            dropData.scheduled
          )
            .diff(DateTime.fromISO(tasksByTime[0][0]))
            .shiftTo('hours', 'minutes')

          if (!confirm(`Shift tasks by ${shiftHours}h${shiftMinutes}m?`)) break

          for (let [time, tasks] of tasksByTime) {
            const timeParse = DateTime.fromISO(time)
            await setters.patchTasks(
              tasks.map((task) => task.id),
              {
                scheduled: toISO(
                  timeParse.plus({ hours: shiftHours, minutes: shiftMinutes })
                ),
              }
            )
          }
          break
        case 'new_button':
          setters.set({ newTask: { scheduled: dropData.scheduled } })
          break
        case 'time':
        case 'task-length':
          if (!dropData.scheduled) return
          const { hours, minutes } = DateTime.fromISO(dropData.scheduled)
            .diff(DateTime.fromISO(dragData.start))
            .shiftTo('hours', 'minutes')
            .toObject() as { hours: number; minutes: number }
          if (dragData.dragType === 'task-length') {
            setters.patchTasks([dragData.id], {
              length: { hour: hours, minute: minutes },
            })
          } else {
            setters.set({
              newTask: {
                scheduled: dragData.start,
                length: { hour: hours, minute: minutes },
              },
            })
          }
          break
        // block and group is rollover
        case 'block':
        case 'group':
          setters.patchTasks(
            dragData.tasks
              .filter((x) => !x.task.queryParent)
              .flatMap((x) =>
                x.type === 'parent' ? x.subtasks.map((x) => x.id) : x.task.id
              ),
            dropData
          )
          break
        case 'task':
          setters.patchTasks(
            dragData.type === 'parent'
              ? dragData.subtasks.map((x) => x.id) ?? []
              : [dragData.task.id],
            dropData
          )
          break
        case 'due':
          setters.patchTasks([dragData.task.id], { due: dropData.scheduled })
          break
      }
    }
  }

  setters.set({ dragData: null })
}

export const onDragStart = (ev: DragStartEvent) => {
  setters.set({ dragData: ev.active.data.current as DragData })
}
