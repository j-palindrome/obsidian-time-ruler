import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { sounds } from '../assets/assets'
import { openTask, openTaskInRuler } from '../services/obsidianApi'
import { TaskPriorities } from '../types/enums'
import Block from './Block'
import { isDateISO } from '../services/util'
import Button from './Button'

export type TaskComponentProps = {
  id: string
  childTasks?: TaskProps[]
  type: TaskProps['type']
}
export default function Task({
  id,
  childTasks,
  type,
  highlight,
  due
}: TaskComponentProps & { highlight?: boolean; due?: boolean }) {
  const task = useAppStore(state => state.tasks[id])

  const completeTask = () => {
    setters.patchTasks([id], {
      completion: DateTime.now().toISODate() as string
    })
  }

  const subtasks = useAppStore(state => {
    return (
      childTasks ??
      task.children.flatMap(child => {
        const subtask = state.tasks[child]
        return subtask
      })
    )
  }, shallow)

  const dragData: DragData = {
    dragType: 'task',
    type,
    id,
    childTasks
  }
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useDraggable({
      id: id + '::' + type + (due ? '::due' : '::scheduled'),
      data: dragData
    })

  const lengthDragData: DragData = {
    dragType: 'task-length',
    id,
    start: task.scheduled ?? ''
  }
  const {
    setNodeRef: setLengthNodeRef,
    attributes: lengthAttributes,
    listeners: lengthListeners
  } = useDraggable({
    id: id + '::' + type + (due ? '::due' : '::scheduled') + '::length',
    data: lengthDragData
  })

  const isLink = ['parent', 'link'].includes(type)

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
            else openTask(task)
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
            <div className='rounded-full p-1 font-menu text-sm font-bold text-accent'>
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
            <div className='text-xs text-accent'>
              {task.length.hour ? `${task.length.hour}h` : ''}
              {task.length.minute ? `${task.length.minute}m` : ''}
            </div>
          )}
          {task.due && (
            <div className='text-xs text-accent'>
              {DateTime.fromISO(task.due).toFormat('EEEEE M/d')}
            </div>
          )}
        </div>
      </div>
      {_.keys(task.extraFields).length > 0 && (
        <div className='no-scrollbar flex space-x-2 overflow-x-auto pl-6 text-xs'>
          {_.sortBy(_.entries(task.extraFields), 0).map(([key, value]) => (
            <div className='flex overflow-hidden rounded child:px-1' key={key}>
              {key}: {value}
            </div>
          ))}
        </div>
      )}
      {type !== 'link' && (
        <div className='pl-6'>
          {subtasks.length > 0 && (
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
              type='child'></Block>
          )}
        </div>
      )}
      {task.scheduled && !isDateISO(task.scheduled) && (
        <div
          className='absolute bottom-0 z-10 h-1 w-full cursor-ns-resize'
          {...lengthAttributes}
          {...lengthListeners}
          ref={setLengthNodeRef}></div>
      )}
    </div>
  )
}
