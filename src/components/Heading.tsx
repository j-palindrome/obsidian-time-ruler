import { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import moment from 'moment'
import { useMemo } from 'react'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { parseDateFromPath, parseHeadingFromPath } from '../services/util'
import ObsidianAPI from '../services/obsidianApi'
import Droppable from './Droppable'

export type HeadingProps = { path: string }
export default function Heading({
  path,
  dragProps,
  idString,
}: {
  path: string
  dragProps?: any
  idString: string
}) {
  const dailyNotePath = useAppStore((state) => state.dailyNotePath)
  const dailyNoteFormat = useAppStore((state) => state.dailyNoteFormat)
  const { name, level } = useMemo(
    () => parseHeadingFromPath(path, dailyNotePath, dailyNoteFormat),
    [path]
  )
  const searchStatus = useAppStore((state) => state.searchStatus)

  const isDate = parseDateFromPath(path, dailyNotePath, dailyNoteFormat)

  const hideHeadings = useAppStore((state) => state.hideHeadings)
  if (hideHeadings) return <></>

  return (
    <>
      {level === 'group' ? (
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
        className={`time-ruler-heading selectable flex w-full space-x-4 rounded-lg pl-7 pr-2 font-menu text-xs child:truncate`}
      >
        <div
          className={`w-fit flex-none cursor-pointer hover:underline ${
            level === 'heading' ? 'text-muted' : 'font-bold text-accent'
          }`}
          onPointerDown={() => false}
          onClick={() => {
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
          }}
        >
          {isDate ? 'Daily' : name}
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
