import _ from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setters, useAppStore } from 'src/app/store'
import { openTaskInRuler } from 'src/services/obsidianApi'
import { convertSearchToRegExp } from 'src/services/util'
import { priorityNumberToKey } from '../types/enums'

export default function Search() {
  const tasks = useAppStore((state) => state.tasks)
  const allTasks: [string[], TaskProps][] = useMemo(
    () =>
      _.sortBy(
        _.values(tasks).filter((task) => !task.completed),
        'id'
      ).map((task) => [
        [
          task.path + task.title,
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
  const foundTasks = allTasks.filter(([strings]) =>
    strings.find((string) => !search || (string && searchExp.test(string)))
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
                {task.path.replace('#', ' # ').replace('.md', '')}
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
