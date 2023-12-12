import { useDraggable } from '@dnd-kit/core'
import { useMemo } from 'react'
import {
  parseFileFromPath,
  parseFolderFromPath,
  parseHeadingFromPath,
  parseHeadingTitle,
} from 'src/services/util'
import { setters, useAppStore } from '../app/store'
import { BlockType } from './Block'
import Button from './Button'
import Droppable from './Droppable'
import Task, { TaskComponentProps } from './Task'

const UNGROUPED = '__ungrouped'

export type GroupComponentProps = {
  hidePaths: string[]
  path: string
  tasks: TaskComponentProps[]
  type: BlockType
  dragContainer: string
}

export default function Group({
  path,
  tasks,
  type,
  hidePaths,
  dragContainer,
}: GroupComponentProps) {
  const collapsed = useAppStore((state) => state.collapsed[path] ?? false)

  const dragData: DragData = {
    dragType: 'group',
    tasks,
    type,
    path,
    hidePaths,
    dragContainer,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${path}::${dragContainer}::${type}`,
      data: dragData,
    })

  const dailyNoteInfo = useAppStore((state) => state.dailyNoteInfo)
  const name = useMemo(
    () => parseHeadingFromPath(path, tasks[0]?.task.page, dailyNoteInfo),
    [path]
  )
  const [fileName, heading] = useMemo(() => {
    const headingName = path
      .slice(path.includes('/') ? path.lastIndexOf('/') + 1 : 0)
      .replace('.md', '')
    return headingName.split('#')
  }, [name])

  const hideHeadings = useAppStore((state) => state.settings.hideHeadings)

  const dragging = useAppStore(
    (state) =>
      state.dragData &&
      state.dragData.dragType === 'group' &&
      parseFileFromPath(state.dragData.path) !== fileName
  )
  if (hideHeadings) return <></>
  const title = parseHeadingTitle(path)

  const container = heading
    ? parseFileFromPath(path)
    : parseFolderFromPath(path)

  return (
    <div
      ref={setNodeRef}
      className={`w-full overflow-hidden`}
      data-id={`${path}::${dragContainer}::${type}`}
      data-info={`${tasks.map((x) => x.task.title).join('; ')}`}
    >
      {path && path !== UNGROUPED && !hidePaths.includes(path) && (
        <>
          {dragging ? (
            <Droppable
              data={{
                type: 'heading',
                heading: parseFileFromPath(name),
              }}
              id={`${dragContainer}::${path}::droppable`}
            >
              <div className='h-2 w-full rounded-lg'></div>
            </Droppable>
          ) : (
            <div className='h-2 w-full rounded-lg'></div>
          )}
          <div
            className={`selectable flex rounded-lg font-menu text-xs group w-full`}
          >
            <div className='w-indent flex-none px-1'>
              <Button
                className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 h-4 py-0.5 flex-none'
                src={collapsed ? 'chevron-right' : 'chevron-down'}
                onClick={() => {
                  setters.patchCollapsed([path], !collapsed)
                  return false
                }}
                onPointerDown={() => false}
              />
            </div>

            <div
              className='w-full flex items-center cursor-grab'
              {...attributes}
              {...listeners}
              ref={setActivatorNodeRef}
            >
              <div
                className={`w-fit flex-none max-w-[50%] ${
                  path.includes('#') ? 'text-normal' : 'text-accent'
                }`}
              >
                {title.slice(0, 40) + (title.length > 40 ? '...' : '')}
              </div>
              <hr className='border-t border-t-faint opacity-50 mx-2 h-0 my-0 w-full'></hr>
              <div className='w-fit flex-none text-right pr-2'>
                {hidePaths.includes(container)
                  ? ''
                  : (
                      container.slice(0, 25) +
                      (container.length > 25 ? '...' : '')
                    ).replace('.md', '')}
              </div>
            </div>
          </div>
        </>
      )}

      {!collapsed && tasks.map((task) => <Task key={task.task.id} {...task} />)}
    </div>
  )
}
