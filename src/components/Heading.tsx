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
} from '../services/util'
import ObsidianAPI, { getDailyNoteInfo } from '../services/obsidianApi'
import Droppable from './Droppable'

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
  const title = useMemo(() => parseHeadingTitle(name), [name])

  const searchStatus = useAppStore((state) => state.searchStatus)

  const hideHeadings = useAppStore((state) => state.hideHeadings)
  if (hideHeadings) return <></>

  return (
    <>
      {name.includes('#') ? (
        <Droppable
          data={{
            type: 'heading',
            heading: name,
          }}
          id={idString}
        >
          <div className='h-2 w-full rounded-lg'></div>
        </Droppable>
      ) : (
        <div className='h-2'></div>
      )}
      <div
        className={`time-ruler-heading selectable flex w-full space-x-4 rounded-lg pl-8 pr-2 font-menu text-xs child:truncate`}
      >
        <div
          className={`w-fit flex-none cursor-pointer hover:underline ${
            name.includes('#') ? 'text-muted' : 'font-bold text-accent'
          }`}
          onPointerDown={() => false}
          onClick={
            isPage
              ? undefined
              : () => {
                  if (!searchStatus || typeof searchStatus === 'string') {
                    app.workspace.openLinkText(path, '')
                  } else if (searchStatus) {
                    const [filePath, heading] = path.split('#')
                    getters
                      .getObsidianAPI()
                      .createTask(filePath + '.md', heading, searchStatus)
                    setters.set({ searchStatus: false })
                  }
                  return false
                }
          }
        >
          {title}
        </div>
        <div
          className='min-h-[12px] w-full cursor-grab text-right text-xs text-faint'
          title={path}
          {...dragProps}
        ></div>
      </div>
    </>
  )
}
