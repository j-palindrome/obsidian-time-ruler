import { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { getters, setters } from 'src/app/store'
import { isTaskProps } from 'src/types/enums'
import { DateTime } from 'luxon'
import { useAppStoreRef } from '../app/store'
import _ from 'lodash'
import { roundMinutes, toISO } from './util'

export const onDragEnd = async (
  ev: DragEndEvent,
  activeDragRef: React.RefObject<DragData | null>
) => {
  const dropData = ev.over?.data.current as DropData | undefined
  const dragData = activeDragRef.current

  if (ev.active.id === ev.over?.id) return

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
          if (dragData.dragType !== 'task') break
          // start from latest task and work backwards
          if (dragData.subtasks?.length) {
            if (!confirm('Delete task and children?')) break
            for (let child of dragData.subtasks.reverse()) {
              await getters.getObsidianAPI().deleteTask(child)
            }
          }
          await getters.getObsidianAPI().deleteTask(dragData.task)
          break
      }
    } else {
      switch (dragData.dragType) {
        case 'now':
          if (!dropData.scheduled) break
          const now = roundMinutes(DateTime.now())
          const nowString = now.toISODate() as string
          const tomorrow = DateTime.now().plus({ days: 1 }).toISODate()
          const futureTasks = _.filter(
            getters.get('tasks'),
            (task) =>
              !!(
                !task.completed &&
                task.scheduled &&
                task.scheduled > nowString &&
                task.scheduled < tomorrow
              )
          )
          const tasksByTime = _.sortBy(
            _.entries(_.groupBy(futureTasks, 'scheduled')),
            0
          )
          const addedHour = DateTime.fromISO(dropData.scheduled).diff(
            DateTime.fromISO(tasksByTime[0][0])
          )

          for (let [time, tasks] of tasksByTime) {
            const timeParse = DateTime.fromISO(time)
            await setters.patchTasks(
              tasks.map((task) => task.id),
              { scheduled: toISO(timeParse.plus(addedHour)) }
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
        case 'group':
        case 'event':
          setters.patchTasks(
            dragData.tasks.flatMap((x) =>
              x.type === 'parent' ? x.children : x.id
            ),
            dropData
          )
          break
        case 'task':
          setters.patchTasks(
            dragData.type === 'parent'
              ? dragData.subtasks ?? []
              : [dragData.task],
            dropData
          )
          break
        case 'due':
          setters.patchTasks([dragData.task.task], { due: dropData.scheduled })
          break
      }
    }
  }

  setters.set({ dragData: null })
}

export const onDragStart = (ev: DragStartEvent) => {
  setters.set({ dragData: ev.active.data.current as DragData })
}
