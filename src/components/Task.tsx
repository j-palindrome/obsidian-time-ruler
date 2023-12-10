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
  task: TaskProps
  subtasks: TaskProps[]
  type: 'deadline' | 'parent' | 'task'
  dragContainer: string
}

export default function Task({
  task,
  subtasks,
  type,
  dragContainer,
  startISO,
}: TaskComponentProps & { startISO?: string }) {
  const completeTask = () => {
    setters.patchTasks([task.id], {
      completion: toISO(roundMinutes(DateTime.now())),
      completed: true,
    })
  }

  const dragData: DragData = {
    dragType: 'task',
    type,
    task: task,
    subtasks,
    dragContainer,
  }
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useDraggable({
      id: `${task}::${type}::${dragContainer}`,
      data: dragData,
    })

  const isLink = ['parent', 'deadline'].includes(type)

  if (!startISO) startISO = task.scheduled

  const collapsed = useAppStore((state) => state.collapsed[task.id] ?? false)

  const hasSameDate = (subtask: TaskProps) =>
    startISO && subtask.scheduled && subtask.scheduled === startISO.slice(0, 10)

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
    id: `${task}::${type}::${length}::${dragContainer}`,
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
      data-id={isLink ? '' : task}
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

        {!task.completed && isLink && task.scheduled && (
          <div
            className='task-scheduled ml-2 cursor-pointer whitespace-nowrap font-menu text-xs text-normal'
            onClick={() => openTaskInRuler(task.id)}
          >
            {DateTime.fromISO(task.scheduled).toFormat('EEEEE M/d')}
          </div>
        )}

        {!task.completed && (
          <DueDate
            task={task}
            dragContainer={`${task}::${type}::${dragContainer}`}
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
            onClick={() => setters.patchCollapsed([task.id], !collapsed)}
          >
            <Button
              src={collapsed ? 'chevron-right' : 'chevron-down'}
              className='h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-1'
            />
          </div>
          {!collapsed && (
            <Block
              dragContainer={dragContainer + task}
              hidePaths={[
                parseHeadingFromPath(task.path, false, dailyNoteInfo),
              ]}
              startISO={startISO}
              tasks={subtasks}
              type='child'
            ></Block>
          )}
        </div>
      )}
    </div>
  )
}
