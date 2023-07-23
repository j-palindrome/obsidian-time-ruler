import { useDraggable, useDroppable } from '@dnd-kit/core'
import _, { escapeRegExp } from 'lodash'
import { getters, setters, useAppStore } from '../app/store'
import Task from './Task'
import Droppable from './Droppable'
import { shallow } from 'zustand/shallow'
import { useMemo } from 'react'
import moment from 'moment'
import { DateTime } from 'luxon'

const UNGROUPED = '__ungrouped'
export type BlockType = 'child' | 'time' | 'event' | 'default' | 'search'
export default function Block({
  hidePaths = [],
  tasks,
  type,
  id,
}: {
  hidePaths?: string[]
  tasks: TaskProps[]
  type: BlockType
  id?: string
}) {
  const tasksByParent = ['parent', 'child'].includes(type)
    ? { undefined: tasks }
    : _.groupBy(tasks, 'parent')

  const taskIds = _.map(tasks, 'id')
  const nestedTasks = useAppStore((state) =>
    _.entries(tasksByParent).flatMap(([parentID, children]) => {
      if (parentID === 'undefined') return children
      else {
        const parentAlreadyIncludedInList = taskIds.includes(parentID)
        if (parentAlreadyIncludedInList) return []
        const parentTask = state.tasks[parentID]
        return {
          ...parentTask,
          children: children.map((x) => x.id),
          type: 'parent',
        } as TaskProps
      }
    })
  )

  const sortedTasks = _.sortBy(nestedTasks, 'position.start.line')
  const groupedTasks = _.groupBy(sortedTasks, 'path')
  const sortedGroups = useAppStore(
    (state) =>
      _.sortBy(_.entries(groupedTasks), ([group, tasks]) =>
        state.fileOrder.indexOf(group)
      ),
    shallow
  )

  const blockId = tasks[0]?.scheduled ?? ''

  return (
    <div
      id={id}
      data-role='block'
      className={`w-full ${type === 'event' ? 'pb-2 pl-2' : ''}`}
    >
      {sortedGroups.map(([name, tasks]) => (
        <Group
          key={tasks[0].id}
          level='group'
          {...{ name, tasks, type, hidePaths, id: blockId }}
        />
      ))}
    </div>
  )
}

export type GroupProps = {
  hidePaths: string[]
  name: string
  tasks: TaskProps[]
  type: BlockType
  level: 'group' | 'heading'
  due?: boolean
  id: string
}

export function Group({
  name,
  tasks,
  type,
  level,
  due,
  hidePaths: hidePaths,
  id,
}: GroupProps) {
  const groupedHeadings =
    level === 'group'
      ? _.groupBy(tasks, (task) => task.heading ?? UNGROUPED)
      : []
  const sortedHeadings =
    level === 'group'
      ? _.sortBy(_.entries(groupedHeadings), [
          ([name, _tasks]) => (name === UNGROUPED ? 1 : 0),
          '1.0.path',
          '1.0.position.start.line',
        ])
      : []

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    level,
    name,
    hidePaths,
    id,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id:
        id +
        '::' +
        name +
        '::' +
        dragData.type +
        '::' +
        level +
        '::' +
        dragData.tasks.map((x) => x.id).join(':'),
      data: dragData,
    })

  return (
    <div ref={setNodeRef} className={`w-full`}>
      {name && name !== UNGROUPED && !hidePaths.includes(name) && (
        <>
          <Droppable
            data={{
              type: 'heading',
              heading: name,
            }}
            id={`${id}::${name}::${dragData.type}::${level}::${dragData.tasks
              .map((x) => x.id)
              .join(':')}::reorder`}
          >
            <div className='h-2 w-full rounded-lg'></div>
          </Droppable>
          <Heading
            dragProps={{
              ...attributes,
              ...listeners,
              ref: setActivatorNodeRef,
            }}
            path={
              tasks[0].path +
              (level === 'heading' ? '#' + tasks[0].heading : '')
            }
          />
        </>
      )}

      {level === 'group'
        ? sortedHeadings.map(([name, tasks], i) => (
            <Group
              level='heading'
              key={name}
              {...{ tasks, name, type, due, hidePaths, id }}
            />
          ))
        : tasks.map((task, i) => (
            <Task
              key={task.id}
              id={task.id}
              type={task.type}
              children={task.children}
            />
          ))}
    </div>
  )
}

export type HeadingProps = { path: string }
export function Heading({
  path,
  dragProps,
}: {
  path: string
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
  const searchStatus = useAppStore((state) => state.searchStatus)
  const { dailyNotePath, dailyNoteFormat } = useAppStore(
    (state) => ({
      dailyNote: state.dailyNote,
      dailyNotePath: state.dailyNotePath,
      dailyNoteFormat: state.dailyNoteFormat,
    }),
    shallow
  )

  const dailyNoteDateTest = useMemo(() => {
    const matchesPath = path.match(
      new RegExp(`${escapeRegExp(dailyNotePath)}\\/(.*)(#|$)`)
    )?.[1]
    if (!matchesPath) return false
    const date = moment(matchesPath, dailyNoteFormat)
    if (!date.isValid()) return false
    return `Daily: ${DateTime.fromJSDate(date.toDate()).toFormat('ccc, LLL d')}`
  }, [])

  return (
    <div
      className={`selectable flex w-full space-x-4 rounded-lg pl-7 pr-2 font-menu text-sm child:truncate`}
    >
      <div
        className={`w-fit flex-none cursor-pointer hover:underline ${
          level === 'heading' ? 'text-muted' : 'font-bold text-accent'
        }`}
        onPointerDown={() => false}
        onClick={() => {
          if (!searchStatus || searchStatus === true) {
            app.workspace.openLinkText(path, '')
          } else if (searchStatus) {
            const [filePath, heading] = path.split('#')
            getters
              .getObsidianAPI()
              .createTask(filePath + '.md', heading, searchStatus)
            setters.set({ searchStatus: false })
          }
          return false
        }}
      >
        {dailyNoteDateTest || name}
      </div>
      <div
        className='min-h-[12px] w-full cursor-grab text-right text-xs text-faint'
        title={path}
        {...dragProps}
      ></div>
    </div>
  )
}
