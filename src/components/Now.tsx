import { useAppStore } from 'src/app/store'
import { Timer } from './Timer'
import {
  addChildren,
  addToBlocks,
  isDateISO,
  roundMinutes,
  toISO,
} from 'src/services/util'
import { filter, groupBy, sortBy } from 'lodash'
import { DateTime } from 'luxon'
import Block, { BlockProps } from './Block'
import { useState } from 'react'
import Starred from './Starred'
import Droppable from './Droppable'
import { nestTasks } from 'src/services/nestTasks'

export default function Now() {
  const now = toISO(roundMinutes(DateTime.now()))
  const today = toISO(roundMinutes(DateTime.now()), true)
  const starred = useAppStore((state) => state.starred)
  const blocksByTime: Record<string, BlockProps> = useAppStore((state) => {
    const blocksByTime: Record<string, BlockProps> = {}
    const nowTasks = filter(
      state.tasks,
      (task) =>
        !!task.scheduled &&
        !isDateISO(task.scheduled) &&
        task.scheduled <= now &&
        !starred.includes(task.id)
    )
    const children = [] as any[]
    nowTasks.forEach((task) => {
      addChildren(state, task, children)
      addToBlocks(today, blocksByTime, task, children)
    })
    for (let key in blocksByTime) {
      blocksByTime[key].tasks = nestTasks(blocksByTime[key].tasks, state.tasks)
    }
    return blocksByTime
  })

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden relative`}>
      <Timer />
      <div className='overflow-auto grow'>
        <Starred />
        <Droppable id='now-heading' data={{ scheduled: now }}>
          <div className='font-bold text-accent mb-1 w-full'>Now</div>
        </Droppable>
        {Object.entries(blocksByTime).map(([key, tasks]) => {
          return (
            <Block
              key={key}
              dragContainer={`now-${key}`}
              startISO={key}
              tasks={tasks.tasks}
              events={[]}
              type='event'
              blocks={[]}
            />
          )
        })}
      </div>
    </div>
  )
}
