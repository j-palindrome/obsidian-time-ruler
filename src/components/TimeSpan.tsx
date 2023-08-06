import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import { isDateISO, processLength } from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Times, { TimeSpanTypes } from './Times'

export default function TimeSpan({
  startISO,
  endISO,
  blocks,
  type,
  startWithHours = false,
  chopStart = false,
  hideTimes = false,
}: {
  startISO: string
  endISO: string
  blocks: BlockData[]
  type: TimeSpanTypes
  startWithHours?: boolean
  chopStart?: boolean
  hideTimes?: boolean
}) {
  const formattedBlocks: {
    startISO: string
    endISO: string
    tasks: TaskProps[]
    events: EventProps[]
    blocks: BlockData[]
  }[] = []

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
      {!hideTimes && (
        <Times
          dragContainer={startISO}
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
                blocks={thisBlocks}
              />

              {!hideTimes && (
                <Times
                  dragContainer={startISO}
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
