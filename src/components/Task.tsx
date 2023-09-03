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
import { TaskPriorities } from '../types/enums'
import Block from './Block'
import Button from './Button'
import { useMemo } from 'react'
import moment from 'moment'
import Logo from './Logo'
import DueDate from './DueDate'

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
  highlight,
}: TaskComponentProps & { highlight?: boolean }) {
  const completeTask = () => {
    setters.patchTasks([id], {
      completion: DateTime.now().toISODate() as string,
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

  const subtasks = useAppStore((state) => {
    if (!task || type === 'deadline') return []
    return (children ?? task.children).flatMap((child) => {
      const subtask = state.tasks[child]
      if (!subtask) return []
      const differentScheduled =
        type === 'task' &&
        subtask.scheduled &&
        subtask.scheduled !== task.scheduled
      if (differentScheduled) return []
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
    id: id + '::' + type + '::length',
    data: lengthDragData,
  })

  const dailyNotePath = useAppStore((state) => state.dailyNotePath)
  const dailyNoteFormat = useAppStore((state) => state.dailyNoteFormat)
  const thisHeading = useMemo(() => {
    const { name: heading } = parseHeadingFromPath(task.path)
    const date = parseDateFromPath(task?.path, dailyNotePath, dailyNoteFormat)
    if (!date) return heading
    return `Daily: ${DateTime.fromJSDate(date.toDate()).toFormat('ccc, LLL d')}`
  }, [task?.path, dailyNotePath, dailyNoteFormat])

  if (!task) return <></>

  return (
    <div
      className={`relative rounded-lg py-0.5 transition-colors duration-300 ${
        type === 'parent' ? 'mt-1' : ''
      }`}
      ref={setNodeRef}
      data-id={isLink || (type === 'search' && task.scheduled) ? '' : id}
    >
      {type === 'deadline' && (
        <div
          className='cursor-pointer pl-7 text-xs text-accent hover:underline'
          onClick={() => app.workspace.openLinkText(task.path, '')}
        >
          {thisHeading}
        </div>
      )}
      <div
        className={`selectable group flex items-center rounded-lg pr-2 ${
          isLink ? 'font-menu text-xs' : 'font-sans'
        }`}
      >
        <div className='flex h-line w-7 flex-none items-center justify-center'>
          <Button
            onPointerDown={() => false}
            onClick={() => completeTask()}
            className={`selectable flex flex-none items-center justify-center rounded-checkbox border border-solid border-faint bg-transparent p-0 text-xs shadow-none hover:border-normal ${
              isLink ? 'h-2 w-2' : 'h-4 w-4'
            }`}
          >
            {task.status}
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
          } ${task.status === 'x' ? 'line-through' : ''}`}
          onPointerDown={() => false}
          onClick={() => openTask(task)}
        >
          {task.title}
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
            <div className='whitespace-nowrap rounded-full px-1 font-menu text-xs font-bold text-accent'>
              {
                {
                  [TaskPriorities.HIGHEST]: '!!!',
                  [TaskPriorities.HIGH]: '!!',
                  [TaskPriorities.MEDIUM]: '!',
                  [TaskPriorities.LOW]: '?',
                  [TaskPriorities.LOWEST]: '...',
                }[task.priority]
              }
            </div>
          )}
        </div>

        {task.scheduled &&
          !isDateISO(task.scheduled) &&
          task.scheduled > (DateTime.now().toISODate() as string) && (
            <div
              className={`cursor-ns-resize whitespace-nowrap font-menu text-xs text-accent ${
                !task.length
                  ? 'opacity-0 transition-opacity duration-100 group-hover:opacity-100'
                  : ''
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

        {(isLink || type == 'search') && task.scheduled && (
          <div
            className='ml-2 cursor-pointer whitespace-nowrap font-menu text-xs text-normal'
            onClick={() => openTaskInRuler(task.position.start.line, task.path)}
          >
            {DateTime.fromISO(task.scheduled).toFormat('EEEEE M/d')}
          </div>
        )}

        <DueDate task={task} dragId={`${id}::${type}::${dragContainer}`} />

        {task.reminder && (
          <div className='ml-2 flex items-center whitespace-nowrap font-menu text-xs text-normal'>
            <Logo src='alarm-clock' className='mr-1' />
            <span>{`${DateTime.fromISO(task.reminder.slice(0, 10)).toFormat(
              'M/d'
            )}${task.reminder.slice(10)}`}</span>
          </div>
        )}
      </div>
      {_.keys(task.extraFields).length > 0 && (
        <div className='no-scrollbar flex space-x-2 overflow-x-auto pl-7 text-xs'>
          {_.sortBy(_.entries(task.extraFields), 0).map(([key, value]) => (
            <div className='flex overflow-hidden rounded child:px-1' key={key}>
              {key}: {value}
            </div>
          ))}
        </div>
      )}
      {!isLink && task.notes && (
        <div className='break-words pl-7 pr-2 text-xs text-faint'>
          {task.notes}
        </div>
      )}

      <div className='pl-6'>
        {subtasks.length > 0 && (
          <Block
            dragContainer={dragContainer + id}
            hidePaths={[task.path]}
            tasks={subtasks.map((subtask) => ({
              ...subtask,
              heading:
                subtask.heading && task.heading
                  ? subtask.heading.replace(task.heading, '')
                  : undefined,
              type:
                type === 'search'
                  ? 'task'
                  : type === 'parent'
                  ? subtask.type
                  : type === 'deadline'
                  ? 'link'
                  : type === 'link' ||
                    (!task.scheduled && subtask.scheduled) ||
                    (task.scheduled &&
                      subtask.scheduled &&
                      subtask.scheduled !== task.scheduled)
                  ? 'link'
                  : 'task',
            }))}
            type='child'
          ></Block>
        )}
      </div>
    </div>
  )
}
