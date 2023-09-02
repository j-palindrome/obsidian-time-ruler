import { DateTime } from 'luxon'
import { openTaskInRuler } from '../services/obsidianApi'
import { TaskComponentProps } from './Task'
import { useDraggable } from '@dnd-kit/core'
import invariant from 'tiny-invariant'

export type DueDateComponentProps = {
  task: TaskProps
  dragId: string
}
export default function DueDate({ task, dragId }: DueDateComponentProps) {
  const dragData: DragData = {
    dragType: 'due',
    task,
    dragId,
  }
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `${dragId}::due`,
    data: dragData,
  })

  return !task.due ? (
    <></>
  ) : (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className='ml-2 cursor-grab whitespace-nowrap font-menu text-xs text-accent'
    >
      {DateTime.fromISO(task.due).toFormat('EEEEE M/d')}
    </div>
  )
}
