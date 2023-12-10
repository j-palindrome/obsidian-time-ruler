import { useDraggable } from '@dnd-kit/core'
import _ from 'lodash'
import { BlockType } from './Block'
import Droppable from './Droppable'
import Heading from './Heading'
import Task, { TaskComponentProps } from './Task'
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
  dragContainer,
  startISO,
}: GroupProps) {
  const collapsed = useAppStore((state) => state.collapsed[path] ?? false)

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    level,
    path: path,
    hidePaths,
    dragContainer,
    startISO,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${path}::${dragContainer}::${type}`,
      data: dragData,
    })

  const props: GroupProps = {
    type,
    due,
    hidePaths,
    path,
    tasks,
    dragContainer,
    startISO,
    level: 'heading',
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-full overflow-hidden`}
      data-id={`${path}::${dragContainer}::${type}`}
    >
      {path && path !== UNGROUPED && !hidePaths.includes(path) && (
        <Heading
          dragProps={{
            ...attributes,
            ...listeners,
            ref: setActivatorNodeRef,
          }}
          path={path}
          isPage={tasks[0].page}
          dragContainer={`${dragContainer}::${path}::${type}::reorder`}
          hidePaths={hidePaths}
        />
      )}

      {!collapsed && (
        <>
          {level === 'group' ? (
            <HeadingGroups {...props} />
          ) : (
            <ParentGroups {...props} />
          )}
        </>
      )}
    </div>
  )
}

function HeadingGroups({
  type,
  due,
  hidePaths,
  path,
  tasks,
  dragContainer,
  startISO,
}: GroupProps) {
  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const groupedHeadings = _.groupBy(tasks, (task) =>
    task.path.includes('#')
      ? parseHeadingFromPath(task.path, task.page, dailyNoteInfo)
      : UNGROUPED
  )

  const sortedHeadings = _.sortBy(_.entries(groupedHeadings), [
    ([name, _tasks]) => (name === UNGROUPED ? 0 : 1),
    '1.0.path',
    '1.0.position.start.line',
  ])

  return (
    <>
      {sortedHeadings.map(([headingName, tasks]) => (
        <Group
          level='heading'
          key={headingName}
          {...{
            tasks,
            path: headingName,
            type,
            due,
            hidePaths: hidePaths.concat([path]),
            dragContainer,
            startISO,
          }}
        />
      ))}
    </>
  )
}

function ParentGroups({
  type,
  due,
  hidePaths,
  path,
  tasks,
  dragContainer,
  startISO,
  level,
}: GroupProps) {
  return <></>
}
