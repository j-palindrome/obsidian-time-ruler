import { Fragment } from 'react'
import { useAppStore } from '../app/store'
import { getEndISO } from '../services/util'

import Block, { BlockProps } from './Block'
import Minutes from './Minutes'

export default function Hours({
  startISO,
  endISO,
  blocks,
  chopStart = false,
  dragContainer = '',
  noExtension = false,
}: {
  startISO: string
  endISO: string
  blocks: BlockProps[]
  startWithHours?: boolean
  chopStart?: boolean
  dragContainer?: string
  noExtension?: boolean
}) {
  const formattedBlocks: BlockProps[] = []
  const extendBlocks = useAppStore((state) => state.settings.extendBlocks)

  for (let i = 0; i < blocks.length; i++) {
    let nestedBlocks: BlockProps[] = []
    const thisBlock = blocks[i]
    console.log('this block', thisBlock, blocks)

    const thisEndISO = getEndISO(thisBlock)

    while (blocks[i + 1] && (blocks[i + 1].startISO as string) < thisEndISO) {
      nestedBlocks.push(blocks[i + 1])
      i++
    }

    formattedBlocks.push({
      ...thisBlock,
      endISO:
        extendBlocks && thisEndISO === thisBlock.startISO
          ? blocks[i + 1]?.startISO ?? endISO
          : thisEndISO,
      blocks: nestedBlocks,
    })
  }

  const hideTimes = useAppStore((state) => state.settings.hideTimes)

  return (
    <div className={`pb-1 relative ${hideTimes ? 'space-y-1' : ''}`}>
      <Minutes
        dragContainer={dragContainer + '::' + startISO}
        startISO={startISO}
        endISO={formattedBlocks[0]?.startISO ?? endISO}
        chopEnd
        chopStart={
          chopStart || startISO === (formattedBlocks[0]?.startISO ?? endISO)
        }
      />

      {formattedBlocks.map(
        (
          {
            startISO: blockStartISO,
            endISO: blockEndISO,
            tasks,
            events,
            blocks,
          },
          i
        ) => (
          <Fragment key={`${blockStartISO}::${events[0]?.id}`}>
            <Block
              startISO={blockStartISO}
              endISO={blockEndISO}
              tasks={tasks}
              events={events}
              blocks={blocks}
              dragContainer={dragContainer + '::' + blockStartISO}
              type='event'
            />

            <Minutes
              dragContainer={dragContainer + '::' + blockStartISO}
              startISO={blockEndISO as string}
              endISO={formattedBlocks[i + 1]?.startISO ?? endISO}
              chopEnd
              chopStart={blockStartISO === blockEndISO}
            />
          </Fragment>
        )
      )}
    </div>
  )
}
