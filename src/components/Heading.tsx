import { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import moment from 'moment'
import { useMemo } from 'react'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'
import { parseDateFromPath, parseHeadingFromPath } from '../services/util'

export type HeadingProps = { path: string }
export default function Heading({
  path,
  dragProps,
}: {
  path: string
  dragProps?: any
}) {
  const { name, level } = useMemo(() => parseHeadingFromPath(path), [path])
  const searchStatus = useAppStore((state) => state.searchStatus)

  const dailyNotePath = useAppStore((state) => state.dailyNotePath)
  const dailyNoteFormat = useAppStore((state) => state.dailyNoteFormat)

  const dailyNoteDateTest = useMemo(() => {
    const date = parseDateFromPath(path, dailyNotePath, dailyNoteFormat)
    if (!date) return false
    return `Daily: ${DateTime.fromJSDate(date.toDate()).toFormat('ccc, LLL d')}`
  }, [path, dailyNotePath, dailyNoteFormat])

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
