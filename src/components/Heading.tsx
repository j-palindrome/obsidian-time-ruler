import { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import moment from 'moment'
import { useMemo } from 'react'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import {
  parseDateFromPath,
  parseHeadingFromPath,
  parseHeadingTitle,
  parsePathFromDate,
} from '../services/util'
import ObsidianAPI, { getDailyNoteInfo } from '../services/obsidianApi'
import Droppable from './Droppable'
import { parseFileFromPath } from '../services/util'
import Logo from './Logo'
import Button from './Button'

export type HeadingProps = { path: string }
export default function Heading({
  path,
  isPage,
  dragProps,
  dragContainer,
  collapsed,
  setCollapsed,
}: {
  path: string
  isPage: boolean
  dragProps?: any
  dragContainer: string
  collapsed: boolean
  setCollapsed?: (collapsed: boolean) => void
}) {
  const dailyNoteInfo = useAppStore(
    ({ dailyNoteFormat, dailyNotePath }) => ({
      dailyNoteFormat,
      dailyNotePath,
    }),
    shallow
  )
  const name = useMemo(
    () => parseHeadingFromPath(path, isPage, dailyNoteInfo),
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
      parseFileFromPath(state.dragData.name) !== fileName
  )
  if (hideHeadings) return <></>

  const topDiv = <div className='h-2 w-full rounded-lg'></div>
  return (
    <>
      {dragging ? (
        <Droppable
          data={{
            type: 'heading',
            heading: parseFileFromPath(name),
          }}
          id={`${dragContainer}::${path}`}
        >
          {topDiv}
        </Droppable>
      ) : (
        topDiv
      )}
      <div
        className={`time-ruler-heading selectable flex w-full rounded-lg pr-2 font-menu text-xs child:truncate group`}
      >
        {setCollapsed && (
          <Button
            className='group-hover:opacity-100 opacity-0 transition-opacity duration-200 w-6 h-4 mx-1 py-0.5 flex-none'
            src={collapsed ? 'chevron-right' : 'chevron-down'}
            onClick={() => {
              setCollapsed(!collapsed)
              return false
            }}
            onPointerDown={() => false}
          />
        )}
        <div
          className={`w-fit flex-none cursor-grab`}
          onPointerDown={() => false}
          onClick={() => false}
        >
          {heading ? (
            <span className='text-normal'>{heading}</span>
          ) : (
            <span className='text-accent'>{fileName}</span>
          )}
        </div>
        <div
          className='min-h-[12px] w-full cursor-grab text-right text-xs text-faint'
          title={path}
          {...dragProps}
        ></div>
      </div>
      <hr className='border-t border-t-selection ml-8 mr-2 mt-1 mb-0 h-0'></hr>
    </>
  )
}
