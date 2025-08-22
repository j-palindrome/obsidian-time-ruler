import { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { getters, setters } from 'src/app/store'
import { isTaskProps, TaskActions } from 'src/types/enums'
import { DateTime, Duration } from 'luxon'
import { useAppStoreRef } from '../app/store'
import _ from 'lodash'
import {
  roundMinutes,
  toISO,
  isDateISO,
  parseTaskDate,
  getChildren,
} from './util'
import invariant from 'tiny-invariant'
import { parseFileFromPath } from './util'
import { getDailyNoteInfo } from './obsidianApi'

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

  if (dragData?.dragType === 'task' && dropData?.type === 'move') {
    setters.set({ newTask: { task: dragData, type: 'move' } })
  } else if (dropData && dragData) {
    if (!isTaskProps(dropData)) {
      switch (dropData.type) {
        case 'starred':
          // Add to starred list and persist in settings
          const obsidianAPI = getters.getObsidianAPI()
          const starred = Array.isArray(getters.get('starred'))
            ? [...getters.get('starred')]
            : []
          if (dragData.dragType === 'task' && !starred.includes(dragData.id)) {
            starred.push(dragData.id)
            setters.setStarred(starred)
          }
          break
        case 'heading':
          if (dragData.dragType !== 'group') break
          setters.updateFileOrder(
            parseFileFromPath(dragData.headingPath),
            parseFileFromPath(dropData.heading)
          )
          break
        case 'delete':
          const tasks = getters.get('tasks')
          let draggedTasks =
            dragData.dragType === 'block' || dragData.dragType === 'group'
              ? dragData.tasks
              : dragData.dragType === 'task'
              ? [dragData]
              : []
          const children = _.sortBy(
            _.uniq(
              _.flatMap(draggedTasks, (task) => [
                task.id,
                ...getChildren(task, tasks),
              ])
            ),
            'id'
          )

          if (children.length > 1) {
            if (!confirm(`Delete ${children.length} tasks and children?`)) break
          }

          await getters.getObsidianAPI().deleteTasks(children.reverse())
          break
      }
    } else {
      switch (dragData.dragType) {
        case 'new-task':
          const obsidianApi = getters.getObsidianAPI()

          // Use the dropped time as the scheduled time
          obsidianApi.createNewTask(
            {
              originalTitle: dragData.title,
              scheduled: dropData.scheduled,
            },
            dragData.path || null,
            getters.get('dailyNoteInfo')
          )

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
              duration: { hour: hours, minute: minutes },
            })
          } else {
            setters.set({
              newTask: {
                task: {
                  scheduled: dragData.start,
                  duration: { hour: hours, minute: minutes },
                },
                type: 'new',
              },
            })
          }
          break

        case 'block':
        case 'group':
          setters.patchTasks(
            dragData.tasks.map((x) => x.id),
            dropData
          )
          break
        case 'task':
          setters.patchTasks([dragData.id], dropData)
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
  setters.set({
    dragData: ev.active.data.current as DragData,
  })
}
