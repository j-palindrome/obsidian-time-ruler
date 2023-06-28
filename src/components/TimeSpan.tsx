import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import { isDateISO } from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Times, { TimeSpanTypes } from './Times'

export type BlockData = [string, (EventProps | TaskProps)[]]
export default function TimeSpan({
  startISO,
  endISO,
  blocks,
  type,
  due,
  startWithHours
}: {
  startISO: string
  endISO: string
  blocks: BlockData[]
  type: TimeSpanTypes
  due?: boolean
  startWithHours?: boolean
}) {
  const now = DateTime.now().toISO() as string

  const formattedBlocks: {
    startISO: string
    endISO: string
    tasks: TaskProps[]
    events: EventProps[]
    blocks: BlockData[]
  }[] = []
  for (let i = 0; i < blocks.length; i++) {
    const [time, items] = blocks[i]

    const events: EventProps[] = []
    const tasks: TaskProps[] = []
    for (let item of items) {
      if (item.type === 'event') events.push(item)
      else tasks.push(item)
    }
    const tasksWithLength = tasks.filter(task => task.length) as (TaskProps & {
      length: NonNullable<TaskProps['length']>
    })[]
    const totalLength =
      events.length > 0
        ? (DateTime.fromISO(events[0].endISO)
            .diff(DateTime.fromISO(events[0].startISO))
            .shiftTo('hour', 'minute')
            .toObject() as { hour: number; minute: number })
        : tasksWithLength.reduce(
            ({ hour, minute }, task) => ({
              hour: hour + task.length.hour,
              minute: minute + task.length.minute
            }),
            { hour: 0, minute: 0 }
          )

    const endTime = DateTime.fromISO(time).plus(totalLength).toISO({
      includeOffset: false,
      suppressMilliseconds: true,
      suppressSeconds: true
    }) as string

    const nextBlocks = blocks
      .slice(i + 1)
      .filter(([time, _items]) => time < endTime)
    i += nextBlocks.length
    formattedBlocks.push({
      startISO: time,
      endISO: endTime,
      tasks,
      events,
      blocks: nextBlocks
    })
  }

  return (
    <div>
      <Times
        type={startWithHours ? 'hours' : type}
        startISO={startISO}
        endISO={blocks[0]?.[0] ?? endISO}
        chopStart
        chopEnd
        due={due}
      />

      {formattedBlocks.map(
        (
          {
            startISO: thisStartISO,
            endISO: thisEndISO,
            tasks: thisTasks,
            events: thisEvents,
            blocks: thisBlocks
          },
          i
        ) => {
          return (
            <Fragment
              key={thisTasks
                .map(x => x.id)
                .concat(thisEvents.map(x => x.id))
                .join('')}>
              <Event
                startISO={thisStartISO}
                endISO={thisEndISO}
                tasks={thisTasks}
                id={thisEvents[0]?.id}
                type={type}
                due={due}
                displayStartISO={thisStartISO}
                blocks={thisBlocks}
              />

              <Times
                type={type}
                startISO={thisEndISO}
                endISO={formattedBlocks[i + 1]?.startISO ?? endISO}
                chopEnd
                chopStart={thisStartISO === thisEndISO}
                due={due}
              />
            </Fragment>
          )
        }
      )}
    </div>
  )
}
