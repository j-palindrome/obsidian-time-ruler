import _, { toSafeInteger } from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore, ViewMode } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import { isDateISO, processLength, toISO } from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Minutes, { TimeSpanTypes } from './Minutes'

export default function Hours({
  startISO,
  endISO,
  blocks,
  type,
  startWithHours = false,
  chopStart = false,
  dragContainer = '',
  noExtension = false,
}: {
  startISO: string
  endISO: string
  blocks: BlockData[]
  type: TimeSpanTypes
  startWithHours?: boolean
  chopStart?: boolean
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
  let maxStart = startISO
  let minEnd = [
    endISO,
    toISO(DateTime.fromISO(endISO).set({ hour: dayStartEnd[1] })),
  ].sort()[0]

  for (let i = 0; i < blocks.length; i++) {
    const [startISO, _tasks] = blocks[i]

    let { events, tasks, endISO: blockEndISO } = processLength(blocks[i])

    const includeNextBlocks = blocks
      .slice(i + 1)
      .filter(([time, _items]) => time < blockEndISO)
    i += includeNextBlocks.length

    const lastChildBlock = includeNextBlocks.last()
    if (lastChildBlock) {
      const { endISO: lastChildEndISO } = processLength(lastChildBlock)
      blockEndISO = [lastChildEndISO, blockEndISO].sort()[1]
    }

    if (blockEndISO === startISO && extendBlocks) {
      const nextBlock = blocks[i + 1]
      if (nextBlock) blockEndISO = nextBlock[0]
      else blockEndISO = endISO
    }

    formattedBlocks.push({
      startISO,
      endISO: blockEndISO,
      tasks,
      events,
      blocks: includeNextBlocks,
    })
  }

  const hideTimes = useAppStore(
    (state) => state.settings.hideTimes || state.viewMode === 'week'
  )

  return (
    <div className={`pb-1 ${hideTimes ? 'space-y-1' : ''}`}>
      {!hideTimes && (
        <Minutes
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
            <Fragment key={`${thisStartISO}::${thisEvents[0]?.id}`}>
              <Event
                startISO={thisStartISO}
                endISO={thisEndISO}
                tasks={thisTasks}
                id={thisEvents[0]?.id}
                type={type}
                nestedBlocks={thisBlocks}
                dragContainer={dragContainer}
              />

              {!hideTimes && (
                <Minutes
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
