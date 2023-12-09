import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { openTask, openTaskInRuler } from '../services/obsidianApi'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import {
  isDateISO,
  parseDateFromPath,
  parseHeadingFromPath,
} from '../services/util'
import { TaskPriorities, priorityNumberToSimplePriority } from '../types/enums'
import Block from './Block'
import Button from './Button'
import { useMemo, useState } from 'react'
import moment from 'moment'
import Logo from './Logo'
import DueDate from './DueDate'
import { roundMinutes, toISO } from '../services/util'

export type TaskComponentProps = {
  id: string
  children?: string[]
  type: TaskProps['type']
  dragContainer: string
}

export default function Task({
  id,
  children,
  type,
  dragContainer,
  startISO,
}: TaskComponentProps & { startISO?: string }) {
  const completeTask = () => {
    setters.patchTasks([id], {
      completion: toISO(roundMinutes(DateTime.now())),
      completed: true,
    })
  }

  const dragData: DragData = {
    dragType: 'task',
    type,
    id,
    children,
    dragContainer,
  }
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useDraggable({
      id: `${id}::${type}::${dragContainer}`,
      data: dragData,
    })

  const isLink = ['parent', 'link', 'deadline'].includes(type)

  let task = useAppStore((state) => state.tasks[id])
  if (!startISO) startISO = task.scheduled

  const collapsed = useAppStore((state) => state.collapsed[id] ?? false)

  const hasSameDate = (subtask: TaskProps) =>
    startISO && subtask.scheduled && subtask.scheduled === startISO.slice(0, 10)
  const differentScheduled = (subtask: TaskProps) =>
    type === 'task' &&
    subtask.scheduled &&
    subtask.scheduled !== (startISO ?? task.scheduled) &&
    !hasSameDate(subtask)

  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const showingPastDates = useAppStore((state) => state.showingPastDates)

  const subtasks = useAppStore((state) => {
    if (!task || type === 'deadline') return []
    return (children ?? task.children).flatMap((child) => {
      const subtask = state.tasks[child]
      if (!subtask) return []

      if (
        differentScheduled(subtask) ||
        (!showCompleted && !showingPastDates && subtask.completed)
      )
        return []
      return subtask
    })
  }, shallow)

  const lengthDragData: DragData = {
    dragType: 'task-length',
    id,
    start: task?.scheduled ?? '',
    end: task?.scheduled ?? '',
  }
  const {
    setNodeRef: setLengthNodeRef,
    attributes: lengthAttributes,
    listeners: lengthListeners,
  } = useDraggable({
    id: `${id}::${type}::${length}::${dragContainer}`,
    data: lengthDragData,
  })

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)

  if (!task) return <></>

  const hasLengthDrag =
    task.length || (task.scheduled && !isDateISO(task.scheduled))

  return (
    <div
      className={`relative rounded-lg py-0.5 transition-colors duration-300 ${
        type === 'parent' ? 'mt-1' : ''
      } w-full`}
      ref={setNodeRef}
      data-id={isLink ? '' : id}
      data-task={task.status === ' ' ? '' : task.status}
    >
      <div
        className={`selectable group flex items-center rounded-lg pr-2 ${
          isLink ? 'font-menu text-xs' : 'font-sans'
        }`}
      >
        <div className='flex h-line w-8 flex-none items-center justify-center'>
          <Button
            onPointerDown={() => false}
            onClick={() => completeTask()}
            className={`task-list-item-checkbox selectable flex flex-none items-center justify-center rounded-checkbox border border-solid border-faint p-0 text-xs shadow-none hover:border-normal ${
              isLink ? 'h-2 w-2' : 'h-4 w-4'
            } ${task.completed ? 'bg-faint' : 'bg-transparent'}`}
            data-task={task.status === ' ' ? '' : task.status}
          >
            {task.status === 'x' ? <></> : task.status}
          </Button>
        </div>
        <div
          className={`w-fit min-w-[24px] cursor-pointer break-words leading-line hover:underline ${
            [TaskPriorities.HIGH, TaskPriorities.HIGHEST].includes(
              task.priority
            )
              ? 'text-accent'
              : type === 'deadline'
              ? ''
              : task.priority === TaskPriorities.LOW ||
                isLink ||
                task.status === 'x'
              ? 'text-faint'
              : ''
          }`}
          onPointerDown={() => false}
          onClick={() => openTask(task)}
        >
          {task.title || 'Untitled'}
        </div>
        <div
          className='flex h-full min-h-line min-w-[24px] grow cursor-grab flex-wrap items-center justify-end space-x-1 font-menu child:my-1'
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
        >
          {task.tags.map((tag) => (
            <div
              className='cm-hashtag cm-hashtag-end cm-hashtag-begin !h-fit !text-xs'
              key={tag}
            >
              {tag.replace('#', '')}
            </div>
          ))}
          {task.priority !== TaskPriorities.DEFAULT && (
            <div className='task-priority whitespace-nowrap rounded-full px-1 font-menu text-xs font-bold text-accent'>
              {priorityNumberToSimplePriority[task.priority]}
            </div>
          )}
        </div>

        {hasLengthDrag && (
          <div
            className={`task-length cursor-ns-resize whitespace-nowrap font-menu text-xs text-accent ${
              !task.length ? 'hidden group-hover:block' : ''
            }`}
            ref={setLengthNodeRef}
            {...lengthAttributes}
            {...lengthListeners}
          >
            {!task.length
              ? 'length'
              : `${task.length?.hour ? `${task.length?.hour}h` : ''}${
                  task.length?.minute ? `${task.length?.minute}m` : ''
                }`}
          </div>
        )}

        {!task.completed && (isLink || type == 'search') && task.scheduled && (
          <div
            className='task-scheduled ml-2 cursor-pointer whitespace-nowrap font-menu text-xs text-normal'
            onClick={() => openTaskInRuler(task.position.start.line, task.path)}
          >
            {DateTime.fromISO(task.scheduled).toFormat('EEEEE M/d')}
          </div>
        )}

        {!task.completed && (
          <DueDate
            task={task}
            dragContainer={`${id}::${type}::${dragContainer}`}
          />
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
      {_.keys(task.extraFields).length > 0 && (
        <div className='no-scrollbar flex space-x-2 overflow-x-auto pl-8 text-xs'>
          {_.sortBy(_.entries(task.extraFields), 0).map(([key, value]) => (
            <div className='flex overflow-hidden rounded child:px-1' key={key}>
              {key}: {value}
            </div>
          ))}
        </div>
      )}
      {!isLink && task.notes && (
        <div className='task-description break-words pl-8 pr-2 text-xs text-faint'>
          {task.notes}
        </div>
      )}
      {subtasks.length > 0 && (
        <div className='flex pl-2 w-full overflow-hidden'>
          <div
            className='group min-w-[16px] grow hover:bg-selection transition-colors duration-500 min-h-[20px] rounded-lg'
            onClick={() => setters.patchCollapsed([id], !collapsed)}
          >
            <Button
              src={collapsed ? 'chevron-right' : 'chevron-down'}
              className='h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-1'
            />
          </div>
          {!collapsed && (
            <Block
              dragContainer={dragContainer + id}
              hidePaths={[
                parseHeadingFromPath(task.path, false, dailyNoteInfo),
              ]}
              startISO={startISO}
              tasks={subtasks.map((subtask) => ({
                ...subtask,
                type:
                  type === 'search'
                    ? 'task'
                    : type === 'parent'
                    ? subtask.type
                    : type === 'deadline'
                    ? 'link'
                    : type === 'link' || differentScheduled(subtask)
                    ? 'link'
                    : 'task',
              }))}
              type='child'
            ></Block>
          )}
        </div>
      )}
    </div>
  )
}
