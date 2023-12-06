import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { BlockType } from './Block'
import Droppable from './Droppable'
import Heading from './Heading'
import Task from './Task'
import { parseFileFromPath, parseHeadingFromPath } from '../services/util'
import { getDailyNoteInfo } from 'src/services/obsidianApi'
import { useAppStore } from '../app/store'
import { shallow } from 'zustand/shallow'
import { memo, useEffect, useState } from 'react'

const UNGROUPED = '__ungrouped'

export type GroupProps = {
  hidePaths: string[]
  path: string
  tasks: TaskProps[]
  type: BlockType
  level: 'group' | 'heading'
  due?: boolean
  id: string
  dragContainer: string
  startISO: string | undefined
}

export default function Group({
  path,
  tasks,
  type,
  level,
  due,
  hidePaths,
  id,
  dragContainer,
  startISO,
}: GroupProps) {
  const dailyNoteInfo = useAppStore(
    ({ dailyNoteFormat, dailyNotePath }) => ({
      dailyNoteFormat,
      dailyNotePath,
    }),
    shallow
  )
  const groupedHeadings =
    level === 'group'
      ? _.groupBy(tasks, (task) =>
          task.path.includes('#')
            ? parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
            : UNGROUPED
        )
      : []

  const sortedHeadings =
    level === 'group'
      ? _.sortBy(_.entries(groupedHeadings), [
          ([name, _tasks]) => (name === UNGROUPED ? 0 : 1),
          '1.0.path',
          '1.0.position.start.line',
        ])
      : []

  const collapsed = useAppStore((state) => state.collapsed[path] ?? false)

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    level,
    path: path,
    hidePaths,
    id,
    dragContainer,
    startISO,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${id}::${tasks[0].path}::${dragContainer}::${type}`,
      data: dragData,
    })

  return (
    <div ref={setNodeRef} className={`w-full`}>
      {path && path !== UNGROUPED && !hidePaths.includes(path) && (
        <Heading
          dragProps={{
            ...attributes,
            ...listeners,
            ref: setActivatorNodeRef,
          }}
          path={path}
          isPage={tasks[0].page}
          dragContainer={`${id}::${path}::${
            dragData.type
          }::${level}::${dragData.tasks.map((x) => x.id).join(':')}::reorder`}
          hidePaths={hidePaths}
        />
      )}

      {!collapsed && (
        <>
          {level === 'group'
            ? sortedHeadings.map(([headingName, tasks]) => (
                <Group
                  level='heading'
                  key={headingName}
                  {...{
                    tasks,
                    path: headingName,
                    type,
                    due,
                    hidePaths: hidePaths.concat([path]),
                    id,
                    dragContainer,
                    startISO,
                  }}
                />
              ))
            : tasks.map((task, i) => (
                <Task
                  dragContainer={dragContainer}
                  key={task.id}
                  id={task.id}
                  type={task.type}
                  children={task.children}
                  startISO={startISO}
                />
              ))}
        </>
      )}
    </div>
  )
}
