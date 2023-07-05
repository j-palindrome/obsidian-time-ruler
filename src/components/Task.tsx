import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { isDateISO } from '../services/util'
import { TaskPriorities } from '../types/enums'
import Block from './Block'
import Button from './Button'

export type TaskComponentProps = {
  id: string
  children?: string[]
  type: TaskProps['type']
}

export default function Task({
  id,
  children,
  type,
  highlight,
  due
}: TaskComponentProps & { highlight?: boolean; due?: boolean }) {
  const completeTask = () => {
    setters.patchTasks([id], {
      completion: DateTime.now().toISODate() as string
    })
  }

  const dragData: DragData = {
    dragType: 'task',
    type,
    id,
    children
  }
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useDraggable({
      id: id + '::' + type + (due ? '::due' : '::scheduled'),
      data: dragData
    })

  const isLink = ['parent', 'link'].includes(type)

  let task = useAppStore(state => state.tasks[id])

  const subtasks = useAppStore(state => {
    if (!task) return []
    return (children ?? task.children).flatMap(child => {
      const subtask = state.tasks[child]
      if (!subtask) return []
      return subtask
    })
  }, shallow)

  const lengthDragData: DragData = {
    dragType: 'task-length',
    id,
    start: task?.scheduled ?? ''
  }
  const {
    setNodeRef: setLengthNodeRef,
    attributes: lengthAttributes,
    listeners: lengthListeners
  } = useDraggable({
    id: id + '::' + type + (due ? '::due' : '::scheduled') + '::length',
    data: lengthDragData
  })

  if (!task) return <></>

  return (
    <div
      className={`relative rounded-lg transition-colors duration-300 ${
        type === 'parent' ? 'mt-1' : ''
      }`}
      ref={setNodeRef}
      data-id={isLink ? '' : id}>
      <div className={`selectable flex rounded-lg py-0.5 pr-2 font-sans`}>
        <div className='flex h-line w-7 flex-none items-center pl-1'>
          <Button
            onPointerDown={() => false}
            onClick={() => completeTask()}
            className='selectable ml-0.5 h-4 w-4 flex-none rounded-checkbox border border-solid border-faint bg-transparent p-0 shadow-none hover:border-normal'
          />
        </div>

        <div
          className={`w-fit min-w-[24px] cursor-pointer break-words leading-line hover:underline ${
            [TaskPriorities.HIGH, TaskPriorities.HIGHEST].includes(
              task.priority
            )
              ? 'text-accent'
              : task.priority === TaskPriorities.LOW || type === 'parent'
              ? 'text-faint'
              : ''
          }`}
          onPointerDown={() => false}
          onClick={() => {
            if (isLink) openTaskInRuler(task.position.start.line, task.path)
            else getters.getObsidianAPI().openTask(task)
          }}>
          {task.title}
        </div>
        <div
          className='no-scrollbar flex min-w-[24px] grow cursor-grab items-center justify-end space-x-1 overflow-x-auto overflow-y-auto rounded-full font-menu'
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}>
          {task.tags.map(tag => (
            <div
              className='cm-hashtag cm-hashtag-end cm-hashtag-begin !h-fit !text-xs'
              key={tag}>
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
                  [TaskPriorities.LOWEST]: '...'
                }[task.priority]
              }
            </div>
          )}
          {task.length && (
            <div className='whitespace-nowrap text-xs text-accent'>
              {task.length.hour ? `${task.length.hour}h` : ''}
              {task.length.minute ? `${task.length.minute}m` : ''}
            </div>
          )}
          {task.due && (
            <div className='whitespace-nowrap text-xs text-accent'>
              {DateTime.fromISO(task.due).toFormat('EEEEE M/d')}
            </div>
          )}
        </div>
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
      {task.notes && (
        <div className='break-words pl-7 pr-2 text-xs text-faint'>
          {task.notes}
        </div>
      )}
      {task.scheduled && !isDateISO(task.scheduled) && (
        <div
          className='-mt-1 h-1 w-full cursor-ns-resize border-muted hover:border-b'
          {...lengthAttributes}
          {...lengthListeners}
          ref={setLengthNodeRef}></div>
      )}
      {type !== 'link' && (
        <div className='pl-6'>
          {subtasks.length > 0 && !due && (
            <Block
              tasks={subtasks.map(subtask => ({
                ...subtask,
                area: subtask.area.replace(task.area, ''),
                heading:
                  subtask.heading && task.heading
                    ? subtask.heading.replace(task.heading, '')
                    : undefined,
                type: type === 'parent' ? subtask.type : 'child'
              }))}
              scheduled={
                (type === 'parent' ? subtasks[0]?.scheduled : task.scheduled) ??
                null
              }
              due={due}
              type='child'></Block>
          )}
        </div>
      )}
    </div>
  )
}
