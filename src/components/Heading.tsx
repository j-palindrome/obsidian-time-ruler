import { escapeRegExp } from 'lodash'
import { DateTime } from 'luxon'
import moment from 'moment'
import { useMemo } from 'react'
import { shallow } from 'zustand/shallow'
import { getters, setters, useAppStore } from '../app/store'

export type HeadingProps = { path: string }
export default function Heading({
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
      new RegExp(`${escapeRegExp(dailyNotePath)}([^\\/#]+)$`)
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
