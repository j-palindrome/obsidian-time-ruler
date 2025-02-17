import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { setters, useAppStore } from '../app/store'
import { openTask } from '../services/obsidianApi'
import {
  getHeading,
  getToday,
  isDateISO,
  nestedScheduled,
  parseTaskDate,
  roundMinutes,
  toISO,
} from '../services/util'
import { TaskPriorities, priorityNumberToSimplePriority } from '../types/enums'
import Block from './Block'
import Button from './Button'
import Logo from './Logo'
import invariant from 'tiny-invariant'

export type TaskComponentProps = TaskProps & {
  subtasks?: TaskProps[]
  dragContainer: string
  startISO?: string
  renderType?: 'deadline'
}
export default function Task({
  dragContainer,
  startISO,
  subtasks,
  renderType,
  ...task
}: TaskComponentProps) {
  const completeTask = () => {
    setters.patchTasks([task.id], {
      completion: toISO(roundMinutes(DateTime.now()), true),
      completed: true,
    })
  }

  subtasks = useAppStore((state) => {
    const taskDate = parseTaskDate(task, state.tasks)
    let newSubtasks = _.flatMap(
      subtasks ??
        task.children
          .concat(task.queryChildren ?? [])
          .map((id) => state.tasks[id]),
      (subtask) => {
        if (!subtask) return []
        if (
          !subtask.scheduled &&
          !subtask.due &&
          !state.settings.scheduledSubtasks
        )
          return []
        if (subtask.due && !task.scheduled) return []

        if (!nestedScheduled(taskDate, parseTaskDate(subtask, state.tasks))) {
          return []
        }
        if (subtask.completed !== state.showingPastDates) return []
        return subtask
      }
    )

    if (!state.settings.scheduledSubtasks && task.scheduled)
      newSubtasks = newSubtasks.filter((task) => task.scheduled)
    return newSubtasks
  })

  const dragData: DragData = {
    dragType: 'task',
    renderType,
    dragContainer,
    ...task,
  }
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useDraggable({
      id: `${task.id}::${renderType}::${dragContainer}`,
      data: dragData,
    })

  const isLink = renderType && ['parent', 'deadline'].includes(renderType)

  if (!startISO) startISO = task.scheduled

  const collapsed = useAppStore((state) => state.collapsed[task.id] ?? false)

  const lengthDragData: DragData = {
    dragType: 'task-length',
    id: task.id,
    start: task?.scheduled ?? '',
    end: task?.scheduled ?? '',
  }
  const {
    setNodeRef: setLengthNodeRef,
    attributes: lengthAttributes,
    listeners: lengthListeners,
  } = useDraggable({
    id: `${task.id}::${renderType}::length::${dragContainer}`,
    data: lengthDragData,
  })

  const deadlineDragData: DragData = {
    dragType: 'due',
    task,
  }
  const {
    setNodeRef: setDeadlineNodeRef,
    attributes: deadlineAttributes,
    listeners: deadlineListeners,
  } = useDraggable({
    id: `${task.id}::${renderType}::deadline::${dragContainer}`,
    data: deadlineDragData,
  })

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const groupBy = useAppStore((state) => state.settings.groupBy)

  if (!task) return <></>

  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const today = getToday()
  const now = DateTime.now().toISO()
  const hasLengthDrag =
    task.scheduled &&
    !isDateISO(task.scheduled) &&
    (showingPastDates ? task.scheduled > today : task.scheduled < now)

  return (
    <div
      className={`relative rounded-icon py-0.5 transition-colors duration-300 w-full min-h-line`}
      data-id={isLink ? '' : task.id}
      data-task={task.status === ' ' ? '' : task.status}
    >
      <div
        className={`selectable group flex items-start rounded-icon pr-2 font-sans ${
          isLink ? 'text-sm' : ''
        }`}
        ref={setNodeRef}
      >
        <div className='flex h-line w-indent flex-none items-center justify-center'>
          <Button
            onPointerDown={() => false}
            onClick={() => completeTask()}
            className={`task-list-item-checkbox selectable flex flex-none items-center justify-center rounded-checkbox border border-solid border-faint p-0 text-xs shadow-none hover:border-normal cursor-pointer ${
              isLink ? 'h-2 w-2' : app.isMobile ? 'h-5 w-5' : 'h-4 w-4'
            } ${task.completed ? 'bg-faint' : 'bg-transparent'}`}
            data-task={task.status === ' ' ? '' : task.status}
          >
            {task.status === 'x' ? <></> : task.status}
          </Button>
        </div>
        <div className={`flex w-full`}>
          <div
            className={`w-fit cursor-pointer break-words leading-line hover:underline ${
              [TaskPriorities.HIGHEST].includes(task.priority)
                ? 'text-accent'
                : renderType === 'deadline'
                ? ''
                : task.priority === TaskPriorities.LOW ||
                  isLink ||
                  task.status === 'x' ||
                  !task.title
                ? 'text-faint'
                : ''
            }`}
            onClick={() => openTask(task)}
          >
            {task.title || 'Untitled'}
          </div>
          <div
            className={`h-line grow items-center space-x-1 font-menu child:my-1 justify-end flex`}
          >
            {task.priority !== TaskPriorities.DEFAULT && (
              <div className='task-priority whitespace-nowrap rounded-full px-1 font-menu text-xs font-bold text-accent'>
                {priorityNumberToSimplePriority[task.priority]}
              </div>
            )}

            {!task.completed && task.reminder && (
              <div className='task-reminder ml-2 flex items-center whitespace-nowrap font-menu text-xs text-normal'>
                <Logo src='alarm-clock' className='mr-1' />
                <span>{`${DateTime.fromISO(task.reminder.slice(0, 10)).toFormat(
                  'M/d'
                )}${task.reminder.slice(10)}`}</span>
              </div>
            )}
          </div>
        </div>
        {hasLengthDrag && (
          <div
            className={`task-duration cursor-ns-resize whitespace-nowrap font-menu text-xs text-accent group-hover:bg-selection group-hover:rounded-full group-hover:px-2 ${
              !task.duration ? 'hidden group-hover:block' : ''
            }`}
            ref={setLengthNodeRef}
            {...lengthAttributes}
            {...lengthListeners}
          >
            {!task.duration
              ? 'length'
              : `${task.duration?.hour ? `${task.duration?.hour}h` : ''}${
                  task.duration?.minute ? `${task.duration?.minute}m` : ''
                }`}
          </div>
        )}

        {!task.completed && (
          <div
            ref={setDeadlineNodeRef}
            {...deadlineAttributes}
            {...deadlineListeners}
            className={`task-due ml-2 cursor-grab whitespace-nowrap font-menu text-xs text-accent hover:underline group-hover:bg-selection group-hover:rounded-full group-hover:px-2 ${
              !task.due ? 'hidden group-hover:block' : ''
            }`}
          >
            {!task.due
              ? 'due'
              : `${Math.floor(
                  DateTime.fromISO(task.due)
                    .diff(
                      DateTime.fromISO(
                        (startISO ??
                          new Date().toISOString().slice(0, 10)) as string
                      )
                    )
                    .shiftTo('days').days
                )}d`}
          </div>
        )}
        <div
          className='flex opacity-0 group-hover:opacity-100 cursor-grab grow items-center ml-1 h-line'
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
        >
          <Logo src='align-justify' className='py-2 px-1 h-full' />
        </div>
      </div>
      {task.tags.length > 0 && groupBy !== 'tags' && (
        <div className='no-scrollbar flex space-x-2 overflow-x-auto pl-indent text-xs child:whitespace-nowrap'>
          {task.tags.map((tag) => (
            <div
              className='cm-hashtag cm-hashtag-end cm-hashtag-begin !h-fit !text-xs'
              key={tag}
            >
              {tag.replace('#', '')}
            </div>
          ))}
        </div>
      )}
      {!isLink && task.notes && (
        <div className='task-description break-words pl-indent pr-2 text-xs text-faint'>
          {task.notes}
        </div>
      )}

      {subtasks && subtasks.length > 0 && (
        <div className='flex w-full overflow-hidden'>
          <div
            className={`min-w-[20px] grow min-h-[12px] flex items-center justify-end ${
              collapsed ? 'pl-indent pr-2' : 'pl-[8px] py-2'
            }`}
          >
            <div
              className='h-full w-full transition-colors duration-300 hover:bg-selection rounded-icon flex items-center justify-center cursor-pointer'
              onClick={() => setters.patchCollapsed([task.id], !collapsed)}
            >
              <div
                className={`${
                  collapsed ? 'h-0 w-full border-t' : 'w-0 h-full border-l'
                } border-0 border-solid border-faint opacity-50`}
              />
            </div>
          </div>

          {!collapsed && subtasks.length > 0 && (
            <Block
              dragContainer={`${dragContainer}::${task.id}`}
              hidePaths={[getHeading(task, dailyNoteInfo, groupBy), task.path]}
              startISO={startISO}
              tasks={subtasks}
              events={[]}
              type='child'
              parentId={task.id}
              blocks={[]}
            ></Block>
          )}
        </div>
      )}
    </div>
  )
}
