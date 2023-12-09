import _ from 'lodash'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getters, setters, useAppStore } from 'src/app/store'
import { convertSearchToRegExp } from 'src/services/util'
import { priorityNumberToKey } from '../types/enums'
import { openTaskInRuler } from 'src/services/obsidianApi'

export default function Search() {
  const tasks = useAppStore((state) => state.tasks)
  const allTasks: [string[], TaskProps][] = useMemo(
    () =>
      _.sortBy(
        _.values(tasks).filter((task) => !task.completed),
        'id'
      ).map((task) => [
        [
          task.title,
          task.path,
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

  return createPortal(
    <div className='modal-container mod-dim !px-2'>
      <div
        className='modal-bg'
        onClick={() => setters.set({ searchStatus: false })}
      ></div>
      <div className='prompt'>
        <div className='prompt-input-container'>
          <input
            className='prompt-input'
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </div>
        <div className='prompt-results'>
          {foundTasks.map(([_strings, task]) => (
            <div
              key={task.id}
              className='suggestion-item mod-complex'
              onClick={() => {
                openTaskInRuler(task.position.start.line, task.path)
                setters.set({ searchStatus: false })
              }}
            >
              <div className='suggestion-content'>{task.title}</div>
              <div
                className='suggestion-aux'
                style={{
                  fontSize: '10px',
                  color: 'var(--text-faint)',
                }}
              >
                {task.path}
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
