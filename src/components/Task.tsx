import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { getters, setters, useAppStore } from '../app/store'
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
import { useEffect, useState } from 'react'

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
  dragging,
  ...task
}: TaskComponentProps & { dragging?: true }) {
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
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    active,
    node,
    activatorEvent,
  } = useDraggable({
    id: `${task.id}::${renderType}::${dragContainer}`,
    data: dragData,
  })

  useEffect(() => {
    if (!active || !activatorEvent) return
    const target = activatorEvent.target as HTMLElement
    // Iterate through target's parents to find element with data-task attribute
    let taskElement = target
    while (
      taskElement &&
      !taskElement.hasAttribute('data-task') &&
      taskElement.parentElement
    ) {
      taskElement = taskElement.parentElement
    }

    if (taskElement && taskElement.hasAttribute('data-task')) {
      // Found element with data-task attribute
      // You can use the found element here for the drag offset calculation
      const rect = taskElement.getBoundingClientRect()
      if (activatorEvent instanceof MouseEvent) {
        setters.set({
          dragOffset: rect.right - activatorEvent.clientX,
        })
      } else if (activatorEvent instanceof TouchEvent) {
        setters.set({
          dragOffset: rect.right - activatorEvent.touches[0].clientX,
        })
      }
    }

    // setters.set({dragOffset: })
  }, [!!active])

  const isLink = renderType && ['parent', 'deadline'].includes(renderType)
  const isCalendar = useAppStore((state) => state.settings.viewMode === 'week')
  const smallText = isLink || isCalendar

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

  const childWidth = useAppStore((state) => state.childWidth)
  const [isWide, setIsWide] = useState(false)
  useEffect(() => {
    const tR = document.getElementById('#time-ruler')
    if (!tR) return
    const width = tR.clientWidth / childWidth
    if (width > 400 && !isWide) setIsWide(true)
    else if (width < 400 && isWide) setIsWide(false)
  }, [childWidth, isWide])

  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const today = getToday()
  const now = DateTime.now().toISO()
  const hasLengthDrag =
    task.scheduled &&
    !isDateISO(task.scheduled) &&
    !(showingPastDates ? task.scheduled > today : task.scheduled < now)

  // Get the computed style for the body element
  const computedStyle = getComputedStyle(document.body)
  // Get the value of the --line-height-normal CSS variable
  const lineHeightNormal = computedStyle
    .getPropertyValue('--line-height-normal')
    .trim()

  return (
    <div
      className={`relative rounded-icon transition-colors duration-300 w-full min-h-line`}
      data-id={isLink ? '' : task.id}
      data-task={task.status === ' ' ? '' : task.status}
    >
      <div
        className={`pt-0.5 selectable group flex items-start rounded-icon pr-2 font-sans overflow-hidden ${
          smallText ? 'text-sm' : ''
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

        <div
          className='flex w-full h-full cursor-grab'
          {...attributes}
          {...listeners}
        >
          <div className={`flex w-full h-full`}>
            <div className='flex w-full mr-4'>
              <div
                style={{ maxHeight: `calc( ${lineHeightNormal}em * 2 )` }}
                className={`w-fit max-w-full cursor-pointer overflow-hidden text-ellipsis ${
                  task.title?.split(' ').find((x) => x.length > 20)
                    ? 'break-all'
                    : 'break-words'
                } leading-line whitespace-normal ${
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
                onMouseDown={() => {
                  openTask(task)
                  return false
                }}
                onClick={() => false}
                onMouseUp={() => false}
              >
                {task.title || 'Untitled'}
              </div>
              <div
                className='h-full w-0 grow'
                {...attributes}
                {...listeners}
              ></div>
            </div>
            <div
              className={`h-line w-fit items-center space-x-1 font-menu child:my-1 justify-end flex`}
              {...attributes}
              {...listeners}
            >
              {task.priority !== TaskPriorities.DEFAULT && (
                <div className='task-priority whitespace-nowrap rounded-full px-1 font-menu text-xs font-bold text-accent'>
                  {priorityNumberToSimplePriority[task.priority]}
                </div>
              )}

              {!task.completed && task.reminder && (
                <div className='task-reminder ml-2 flex items-center whitespace-nowrap font-menu text-xs text-normal'>
                  <Logo src='alarm-clock' className='mr-1' />
                  <span>{`${DateTime.fromISO(
                    task.reminder.slice(0, 10)
                  ).toFormat('M/d')}${task.reminder.slice(10)}`}</span>
                </div>
              )}
            </div>
          </div>
          {!dragging && (
            <div className='flex h-full'>
              {hasLengthDrag && (
                <div
                  className={`mt-1 task-duration cursor-ns-resize whitespace-nowrap font-menu text-xs text-accent group-hover:bg-selection group-hover:rounded-full group-hover:px-2 ${
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
                  className={`mt-1 task-due ml-2 cursor-grab whitespace-nowrap font-menu text-xs text-accent hover:underline group-hover:bg-selection group-hover:rounded-full group-hover:px-2 ${
                    !task.due ? 'hidden group-hover:block' : ''
                  }`}
                >
                  {!task.due
                    ? 'due'
                    : `${Math.ceil(
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
            </div>
          )}

          {!task.completed && task.reminder && !dragging && (
            <div className='task-reminder ml-2 flex items-center whitespace-nowrap font-menu text-xs text-normal'>
              <Logo src='alarm-clock' className='mr-1' />
              <span>{`${DateTime.fromISO(task.reminder.slice(0, 10)).toFormat(
                'M/d'
              )}${task.reminder.slice(10)}`}</span>
            </div>
          )}
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
              className='h-full w-full transition-colors duration-200 hover:bg-selection rounded-icon flex items-center justify-center cursor-pointer'
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
            />
          )}
        </div>
      )}
    </div>
  )
}
