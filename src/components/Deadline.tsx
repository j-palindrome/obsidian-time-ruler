import { useDraggable } from '@dnd-kit/core'
import { DateTime } from 'luxon'

export type DueDateComponentProps = {
  task: TaskProps
  dragContainer: string
  isDragging?: boolean
}
export default function Deadline({
  task,
  dragContainer,
  isDragging = false,
}: DueDateComponentProps) {
  const dragData: DragData = {
    dragType: 'due',
    task,
    dragContainer: dragContainer,
  }
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `${dragContainer}::due`,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`task-due ml-2 cursor-grab whitespace-nowrap font-menu text-xs text-accent hover:underline ${
        !task.due && !isDragging ? 'hidden group-hover:block' : ''
      }`}
    >
      {!task.due ? 'due' : DateTime.fromISO(task.due).toFormat('EEEEE M/d')}
    </div>
  )
}
