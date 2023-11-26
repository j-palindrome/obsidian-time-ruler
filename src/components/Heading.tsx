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

export type HeadingProps = { path: string }
export default function Heading({
  path,
  isPage,
  dragProps,
  idString,
}: {
  path: string
  isPage: boolean
  dragProps?: any
  idString: string
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

  const searchStatus = useAppStore((state) => state.searchStatus)

  const hideHeadings = useAppStore((state) => state.hideHeadings)
  if (hideHeadings) return <></>

  return (
    <>
      <Droppable
        data={{
          type: 'heading',
          heading: parseFileFromPath(name),
        }}
        id={idString}
      >
        <div className='h-2 w-full rounded-lg'></div>
      </Droppable>
      <div
        className={`time-ruler-heading selectable flex w-full space-x-4 rounded-lg pl-8 pr-2 font-menu text-xs child:truncate`}
      >
        <div
          className={`w-fit flex-none cursor-pointer hover:underline`}
          onPointerDown={() => false}
          onClick={() => {
            if (!searchStatus || typeof searchStatus === 'string') {
              app.workspace.openLinkText(
                path === 'Daily'
                  ? parsePathFromDate(DateTime.now().toISODate(), dailyNoteInfo)
                  : path,
                ''
              )
            }
            return false
          }}
        >
          <span className='text-accent'>{fileName}</span>
          {heading && <span className='text-normal pl-1'>{heading}</span>}
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
