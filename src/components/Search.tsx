import _ from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setters, useAppStore } from 'src/app/store'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { convertSearchToRegExp } from 'src/services/util'
import { priorityNumberToKey } from '../types/enums'
import { parseFolderFromPath } from '../services/util'

export default function Search() {
  const tasks = useAppStore((state) => state.tasks)
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const showCompleted = useAppStore((state) => state.settings.showCompleted)
  const allTasks: [string[], TaskProps][] = useMemo(
    () =>
      _.sortBy(
        _.values(tasks).filter(
          (task) => showCompleted || task.completed === showingPastDates
        ),
        'id'
      ).map((task) => [
        [
          (task.page ? parseFolderFromPath(task.path) : task.path) + task.title,
          task.tags.map((x) => '#' + x).join(' '),
          task.notes ?? '',
          priorityNumberToKey[task.priority],
          task.status,
        ],
        task,
      ]),
    [tasks]
  )
  const [search, setSearch] = useState('')
  const searchExp = convertSearchToRegExp(search)
  const splitSearch = search.split('')
  const foundTasks = _.sortBy(
    allTasks.filter(([strings]) =>
      strings.find((string) => !search || (string && searchExp.test(string)))
    ),
    ([_matches, task]) => {
      let total = 0
      let index = 0
      const title = task.title.toLowerCase()
      let notFound = 0
      for (let char of splitSearch) {
        const newIndex = title.indexOf(char, index)
        if (newIndex !== -1) {
          total += newIndex
          index = newIndex
        } else notFound += 1
      }

      return notFound * 25 + total
    }
  )

  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  return createPortal(
    <div className='modal-container mod-dim'>
      <div
        className='modal-bg'
        onClick={() => setters.set({ searchStatus: false })}
      ></div>
      <div className='prompt'>
        <div className='prompt-input-container'>
          <input
            className='prompt-input'
            style={{ fontFamily: 'var(--font-interface)' }}
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Escape') setters.set({ searchStatus: false })
              else if (ev.key === 'Enter') {
                if (foundTasks[0]) openTaskInRuler(foundTasks[0][1].id)
                setters.set({ searchStatus: false })
              }
            }}
            ref={input}
          />
        </div>
        <div className='prompt-results'>
          {foundTasks.map(([_strings, task]) => (
            <div
              key={task.id}
              data-info={task.id}
              className='clickable-icon suggestion-item mod-complex'
              onClick={() => {
                openTaskInRuler(task.id)
                setters.set({ searchStatus: false })
              }}
            >
              <div
                className='suggestion-content'
                style={{
                  color: 'var(--text-normal)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.title}
              </div>
              <div
                className='suggestion-aux'
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '40%',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  color: 'var(--text-faint)',
                  flex: 'none',
                }}
              >
                {(task.page
                  ? parseFolderFromPath(task.path)
                  : task.path
                ).replace('.md', '')}
              </div>
            </div>
          ))}
        </div>
        <div className='prompt-instructions'></div>
      </div>
    </div>,
    document.querySelector('.app-container') as HTMLDivElement
  )
}
