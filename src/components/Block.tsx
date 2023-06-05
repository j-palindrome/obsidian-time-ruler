import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { DateTime } from 'luxon'
import { useAppStore } from '../app/store'
import Droppable from './Droppable'
import Task from './Task'

const UNGROUPED = '__ungrouped'
export type BlockType = 'child' | 'time' | 'event' | 'default'
export default function Block({
  tasks,
  type,
  id,
  due
}: {
  tasks: TaskProps[]
  type: BlockType
  id?: string
  due?: boolean
}) {
  const tasksByParent = ['parent', 'child'].includes(type)
    ? { undefined: tasks }
    : _.groupBy(tasks, 'parent')

  const taskIds = _.map(tasks, 'id')
  const nestedTasks = useAppStore(state =>
    _.entries(tasksByParent).flatMap(([parentID, children]) => {
      if (parentID === 'undefined') return children
      else {
        const parentAlreadyIncludedInList = taskIds.includes(parentID)
        if (parentAlreadyIncludedInList) return []
        const parentTask = _.cloneDeep(state.tasks[parentID])
        parentTask.children = children.map(x => x.id)
        parentTask.type = 'parent'
        return parentTask
      }
    })
  )

  const sortedTasks = _.sortBy(nestedTasks, 'position.start.line')
  const groupedTasks = _.groupBy(sortedTasks, 'area')
  const sortedGroups = _.sortBy(_.entries(groupedTasks), 0)

  return (
    <div
      id={id}
      data-role='block'
      className={`w-full ${type === 'event' ? 'pb-2 pl-2' : ''}`}>
      {sortedGroups.map(([name, tasks]) => (
        <Group
          key={tasks[0].id}
          level='group'
          {...{ name, tasks, type, due }}
        />
      ))}
    </div>
  )
}

export type GroupProps = {
  name: string
  tasks: TaskProps[]
  type: BlockType
  level: 'group' | 'heading'
  due?: boolean
}
export function Group({ name, tasks, type, level, due }: GroupProps) {
  const groupedHeadings =
    level === 'group' ? _.groupBy(tasks, task => task.heading ?? UNGROUPED) : []
  const sortedHeadings =
    level === 'group'
      ? _.sortBy(_.entries(groupedHeadings), [
          ([name, _tasks]) => (name === UNGROUPED ? 1 : 0),
          '1.0.path',
          '1.0.position.start.line'
        ])
      : []

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    level,
    name
  }
  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id:
        name +
        '::' +
        dragData.type +
        '::' +
        level +
        '::' +
        (dragData.dragType === 'group'
          ? dragData.tasks.map(x => x.id).join(':')
          : ''),
      data: dragData
    })

  return (
    <div ref={setNodeRef} className={`w-full`}>
      {name && name !== UNGROUPED && (
        <Heading
          dragProps={{
            ...attributes,
            ...listeners,
            ref: setActivatorNodeRef
          }}
          path={
            tasks[0].path + (level === 'heading' ? '#' + tasks[0].heading : '')
          }
        />
      )}

      {level === 'group'
        ? sortedHeadings.map(([name, tasks], i) => (
            <Group
              level='heading'
              key={name}
              tasks={tasks}
              name={name}
              type={type}
              due={due}
            />
          ))
        : tasks.map((task, i) => (
            <Task key={task.id} id={task.id} type={task.type} due={due} />
          ))}
    </div>
  )
}

export type HeadingProps = { path: string }
export function Heading({
  path,
  noPadding,
  dragProps
}: {
  path: string
  noPadding?: boolean
  dragProps?: any
}) {
  const level = path.includes('#') ? 'heading' : 'group'
  const name = (
    level === 'heading'
      ? path.slice(path.lastIndexOf('#') + 1)
      : path.includes('/')
      ? path.slice(path.lastIndexOf('/') + 1)
      : path
  ).replace(/\.md/, '')

  const parent =
    level === 'group' && path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''

  return (
    <div
      className={`selectable mt-2 flex w-full space-x-4 rounded-lg pr-2 font-menu text-sm child:truncate ${
        noPadding ? 'pl-2' : 'pl-7'
      }`}>
      <div
        className={`w-fit flex-none cursor-pointer hover:underline ${
          level === 'heading' ? 'text-muted' : 'font-bold text-accent'
        }`}
        onPointerDown={() => false}
        onClick={() => {
          app.workspace.openLinkText(path, '')
          return false
        }}>
        {name}
      </div>
      <div
        className='min-h-[12px] w-full cursor-grab text-right text-xs text-faint'
        title={path}
        {...dragProps}></div>
    </div>
  )
}
