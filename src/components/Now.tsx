import { useAppStore } from 'src/app/store'
import { Timer } from './Timer'
import { isDateISO, roundMinutes, toISO } from 'src/services/util'
import { filter, groupBy, sortBy } from 'lodash'
import { DateTime } from 'luxon'
import Block from './Block'
import { useState } from 'react'
import Starred from './Starred'
import Droppable from './Droppable'

export default function Now() {
  const now = toISO(roundMinutes(DateTime.now()))
  const today = toISO(roundMinutes(DateTime.now()), true)
  const starred = useAppStore((state) => state.starred)
  const nowTasks = useAppStore((state) =>
    filter(
      state.tasks,
      (task) =>
        !!task.scheduled &&
        !isDateISO(task.scheduled) &&
        task.scheduled <= now &&
        !starred.includes(task.id)
    )
  )
  const scheduledTimes = groupBy(nowTasks, 'scheduled')
  const blocksByTime = sortBy(Object.entries(scheduledTimes), 0).map(
    (x) => x[1]
  )

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden relative`}>
      <Timer />
      <div className='overflow-auto grow'>
        <Starred />
        <Droppable id='now-heading' data={{ scheduled: now }}>
          <div className='font-bold text-accent mb-1 w-full'>Now</div>
        </Droppable>
        {blocksByTime.map((tasks, index) => {
          return (
            <Block
              key={tasks[0].scheduled}
              dragContainer={`now-${tasks[0].scheduled}`}
              startISO={tasks[0].scheduled!}
              tasks={tasks}
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
