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
  startWithHours = false,
  chopStart = false,
}: {
  startISO: string
  endISO: string
  blocks: BlockData[]
  type: TimeSpanTypes
  startWithHours?: boolean
  chopStart?: boolean
}) {
  const now = DateTime.now().toISO() as string
  const calendarMode = useAppStore((state) => state.calendarMode)

  const formattedBlocks: {
    startISO: string
    endISO: string
    tasks: TaskProps[]
    events: EventProps[]
    blocks: BlockData[]
  }[] = []

  const processLength = ([time, items]: BlockData) => {
    const events: EventProps[] = []
    const tasks: TaskProps[] = []

    for (let item of items) {
      if (item.type === 'event') events.push(item)
      else tasks.push(item)
    }
    const tasksWithLength = tasks.filter(
      (task) => task.length
    ) as (TaskProps & {
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
              minute: minute + task.length.minute,
            }),
            { hour: 0, minute: 0 }
          )

    const endTime = DateTime.fromISO(time).plus(totalLength).toISO({
      includeOffset: false,
      suppressMilliseconds: true,
      suppressSeconds: true,
    }) as string

    return { events, tasks, endISO: endTime }
  }

  for (let i = 0; i < blocks.length; i++) {
    const [startISO, _tasks] = blocks[i]

    let { events, tasks, endISO } = processLength(blocks[i])

    const includeNextBlocks = blocks
      .slice(i + 1)
      .filter(([time, _items]) => time < endISO)
    i += includeNextBlocks.length

    const lastChildBlock = includeNextBlocks.last()
    if (lastChildBlock) {
      const { endISO: lastEndISO } = processLength(lastChildBlock)
      if (lastEndISO > endISO) {
        endISO = lastEndISO
      }
    }

    formattedBlocks.push({
      startISO,
      endISO,
      tasks,
      events,
      blocks: includeNextBlocks,
    })
  }

  return (
    <div className='pb-1'>
      {!calendarMode && (
        <Times
          type={startWithHours ? 'hours' : type}
          startISO={startISO}
          endISO={blocks[0]?.[0] ?? endISO}
          chopStart={chopStart}
          chopEnd
        />
      )}

      {formattedBlocks.map(
        (
          {
            startISO: thisStartISO,
            endISO: thisEndISO,
            tasks: thisTasks,
            events: thisEvents,
            blocks: thisBlocks,
          },
          i
        ) => {
          return (
            <Fragment
              key={thisTasks
                .map((x) => x.id)
                .concat(thisEvents.map((x) => x.id))
                .join('')}
            >
              <Event
                startISO={thisStartISO}
                endISO={thisEndISO}
                tasks={thisTasks}
                id={thisEvents[0]?.id}
                type={type}
                displayStartISO={thisStartISO}
                blocks={thisBlocks}
              />

              {calendarMode ? (
                <div className='h-2'></div>
              ) : (
                <Times
                  type={type}
                  startISO={thisEndISO}
                  endISO={formattedBlocks[i + 1]?.startISO ?? endISO}
                  chopEnd
                  chopStart={thisStartISO === thisEndISO}
                />
              )}
            </Fragment>
          )
        }
      )}
    </div>
  )
}
