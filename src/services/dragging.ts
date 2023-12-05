import { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { getters, setters } from 'src/app/store'
import { isTaskProps } from 'src/types/enums'
import { DateTime } from 'luxon'
import { useAppStoreRef } from '../app/store'

export const onDragEnd = async (
  ev: DragEndEvent,
  activeDragRef: React.RefObject<DragData | null>
) => {
  const dropData = ev.over?.data.current as DropData | undefined
  const dragData = activeDragRef.current

  console.log(dropData, dragData)

  if (dragData?.dragType === 'new_button' && !dropData) {
    setters.set({ newTask: { scheduled: undefined } })
  } else if (dropData && dragData) {
    if (!isTaskProps(dropData)) {
      switch (dropData.type) {
        case 'heading':
          if (dragData.dragType !== 'group') return
          setters.updateFileOrder(dragData.name, dropData.heading)
          break
        case 'delete':
          if (dragData.dragType !== 'task') return
          if (dragData.children) {
            if (!confirm('Delete task and children?')) return
          }
          // start from latest task and work backwards
          if (dragData.children) {
            for (let child of dragData.children.reverse()) {
              await getters.getObsidianAPI().deleteTask(child)
            }
          }
          await getters.getObsidianAPI().deleteTask(dragData.id)
          break
      }
    } else {
      switch (dragData.dragType) {
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
              ? dragData.children ?? []
              : [dragData.id],
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
