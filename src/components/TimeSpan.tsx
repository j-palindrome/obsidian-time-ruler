import _, { toSafeInteger } from 'lodash'
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
  dragContainer = '',
  noExtension = false,
}: {
  startISO: string
  endISO: string
  blocks: BlockData[]
  type: TimeSpanTypes
  startWithHours?: boolean
  chopStart?: boolean
  hideTimes?: boolean
  dragContainer?: string
  noExtension?: boolean
}) {
  const formattedBlocks: {
    startISO: string
    endISO: string
    tasks: TaskProps[]
    events: EventProps[]
    blocks: BlockData[]
  }[] = []

  const dayStartEnd = useAppStore((state) => state.settings.dayStartEnd)
  const extendBlocks = useAppStore((state) => state.settings.extendBlocks)
  const testStart = DateTime.fromISO(startISO)
  const maxStart = DateTime.max(
    testStart,
    testStart.set({ hour: dayStartEnd[0] })
  ).toISO() as string
  const testEnd = DateTime.fromISO(endISO)
  const minEnd = DateTime.min(
    testEnd,
    testStart.set({ hour: dayStartEnd[1] })
  ).toISO() as string

  for (let i = 0; i < blocks.length; i++) {
    const [startISO, _tasks] = blocks[i]

    let { events, tasks, endISO: endBlockISO } = processLength(blocks[i])

    const includeNextBlocks = blocks
      .slice(i + 1)
      .filter(([time, _items]) => time < endBlockISO)
    i += includeNextBlocks.length

    const lastChildBlock = includeNextBlocks.last()
    if (lastChildBlock) {
      const { endISO: lastEndISO } = processLength(lastChildBlock)
      if (lastEndISO > endBlockISO) endBlockISO = lastEndISO
      else endBlockISO = endISO
    }

    if (endBlockISO === startISO && extendBlocks) {
      const nextBlock = blocks[i + 1]
      if (nextBlock) endBlockISO = nextBlock[0]
      else endBlockISO = endISO
    }

    formattedBlocks.push({
      startISO,
      endISO: endBlockISO,
      tasks,
      events,
      blocks: includeNextBlocks,
    })
  }

  return (
    <div className={`pb-1 ${hideTimes ? 'space-y-2' : ''}`}>
      {!hideTimes && (
        <Times
          dragContainer={dragContainer + '::' + startISO}
          type={startWithHours ? 'hours' : type}
          startISO={maxStart}
          endISO={blocks[0]?.[0] ?? minEnd}
          chopStart={chopStart}
          chopEnd
          noExtension={noExtension}
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
                dragContainer={dragContainer}
              />

              {!hideTimes && (
                <Times
                  dragContainer={dragContainer + '::' + startISO}
                  type={type}
                  startISO={_.max([maxStart, thisEndISO]) as string}
                  endISO={formattedBlocks[i + 1]?.startISO ?? minEnd}
                  chopEnd
                  chopStart={thisStartISO === thisEndISO}
                  noExtension={noExtension}
                />
              )}
            </Fragment>
          )
        }
      )}
    </div>
  )
}
