import { useAppStore } from 'src/app/store'
import { TaskComponentProps } from './Task'
import { DateTime } from 'luxon'
import invariant from 'tiny-invariant'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { shallow } from 'zustand/shallow'
import Block from './Block'

export default function TaskLink({
  id,
  children,
  type,
  highlight,
  due
}: TaskComponentProps & { highlight?: boolean; due?: boolean }) {
  let task = useAppStore(state => state.tasks[id])

  const subtasks = useAppStore(state => {
    if (!task) return []
    return (children ?? task.children).flatMap(child => {
      const subtask = state.tasks[child]
      if (!subtask) return []
      return { ...subtask, type: type === 'link' ? 'link' : subtask.type }
    })
  }, shallow)

  return (
    <div>
      <div
        className='selectable flex cursor-pointer items-center rounded-lg py-0.5 pr-2 child:text-xs'
        onClick={() => openTaskInRuler(task.position.start.line, task.path)}>
        <div className='ml-3 mr-3 h-1 w-1 flex-none rounded-full bg-faint'></div>

        <div className='w-full text-faint hover:underline'>{task.title}</div>
        {task.scheduled && (
          <div className='whitespace-nowrap text-accent'>
            {DateTime.fromISO(task.scheduled).toFormat('EEEEE M/d')}
          </div>
        )}
      </div>
      <div className='pl-6'>
        {subtasks.length > 0 && (
          <Block
            tasks={subtasks.map(subtask => ({
              ...subtask,
              heading:
                subtask.heading && task.heading
                  ? subtask.heading.replace(task.heading, '')
                  : undefined,
              type: subtask.type
            }))}
            due={due}
            type='child'></Block>
        )}
      </div>
    </div>
  )
}
