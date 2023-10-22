import { useState } from 'react'
import Button from './Button'
import { DateTime } from 'luxon'
import { getters } from '../app/store'

export default function EditWindow({
  tasks,
  hideThis,
}: {
  tasks: TaskProps[]
  hideThis: () => void
}) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')

  return (
    <div
      className='fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black/50'
      onClick={(ev) => hideThis()}
    >
      <div
        className='tr-menu !static !left-auto !top-auto'
        onClick={(ev) => ev.stopPropagation()}
      >
        <div>
          Bulk edit tasks
          <div className='flex'>
            <input
              className='w-[3em]'
              value={hours}
              onChange={(ev) => setHours(ev.target.value)}
              pattern='\d*'
              type='number'
            ></input>
            h{' '}
            <input
              className='w-[3em]'
              value={minutes}
              onChange={(ev) => setMinutes(ev.target.value)}
              pattern='\d*'
              type='number'
            ></input>
            m
            <Button
              onClick={() => {
                const api = getters.getObsidianAPI()
                for (let task of tasks) {
                  if (!task.scheduled) continue
                  api.saveTask({
                    ...task,
                    scheduled: DateTime.fromISO(task.scheduled)
                      .plus({
                        hour: Number(hours ?? 0),
                        minute: Number(minutes ?? 0),
                      })
                      .toISO() as string,
                  })
                }
                hideThis()
              }}
            >
              GO
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
