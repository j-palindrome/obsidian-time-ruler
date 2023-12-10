import { useDraggable, useDroppable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import {
  isLengthType,
  roundMinutes,
  toISO,
  useHourDisplay,
} from '../services/util'
import ObsidianAPI from '../services/obsidianApi'
import { getters, setters, useAppStore } from '../app/store'
import Button from './Button'
import Droppable from './Droppable'
import { Fragment, useEffect } from 'react'

export type TimeSpanTypes = 'minutes' | 'hours'
export default function Minutes({
  startISO,
  endISO,
  type = 'minutes',
  chopEnd,
  chopStart,
  dragContainer,
  noExtension,
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  chopEnd?: boolean
  chopStart?: boolean
  dragContainer: string
  noExtension?: boolean
}) {
  const times: DateTime[] = []
  const givenStart = DateTime.fromISO(startISO)
  const givenEnd = DateTime.fromISO(endISO)
  const showingPastDates = useAppStore((state) => state.showingPastDates)

  let start = roundMinutes(
    showingPastDates || noExtension
      ? givenStart
      : DateTime.max(givenStart, DateTime.now())
  )
  let end = roundMinutes(
    !showingPastDates || noExtension
      ? givenEnd
      : DateTime.min(givenEnd, DateTime.now())
  )

  const modifier: { [K in TimeSpanTypes]: Parameters<DateTime['plus']>[0] } = {
    minutes: { minutes: 15 },
    hours: { hours: 1 },
  }
  const now = roundMinutes(DateTime.now())
  const nowISO = toISO(now)
  if (chopStart && !(start <= now && end > now))
    start = start.plus(modifier[type])
  if (chopEnd) end = end.minus(modifier[type])

  while (start <= end) {
    times.push(start.plus({}))
    start = start.plus(
      type === 'minutes'
        ? { minute: 15 }
        : type === 'hours'
        ? { hour: 1 }
        : { day: 1 }
    )
  }

  const startISOs = times.map((time) => toISO(time))

  return (
    <div className={`min-h-[4px]`}>
      {times.map((time, i) =>
        startISOs[i] === nowISO ? (
          <NowTime key={startISOs[i]} dragContainer={dragContainer} />
        ) : (
          <Time key={startISOs[i]} {...{ type, time, dragContainer }} />
        )
      )}
    </div>
  )
}

export type TimeProps = {
  time: DateTime
  type: TimeSpanTypes
  dragContainer: string
}

function Time({ time, type, dragContainer }: TimeProps) {
  const minutes = time.minute
  const hours = time.hour
  const day = time.weekday
  const date = time.day
  const iso = toISO(time)

  const { isOver, setNodeRef } = useDroppable({
    id: dragContainer + '::' + iso + '::scheduled',
    data: { scheduled: iso } as DropData,
  })

  const dragData: DragData = {
    dragType: 'time',
    start: iso,
  }

  const {
    setNodeRef: setDragNodeRef,
    attributes,
    listeners,
  } = useDraggable({
    id: `${time}::time::${dragContainer}`,
    data: dragData,
  })

  const isDraggingTime = useAppStore((state) =>
    isLengthType(state.dragData?.dragType)
  )

  useEffect(() => {
    if (isDraggingTime && isOver) {
      setters.set({
        dragData: { ...getters.get('dragData'), end: iso } as DragData,
      })
    }
  }, [isOver, isDraggingTime])

  const selectedClassName = useAppStore((state) => {
    if (
      !state.dragData ||
      !isLengthType(state.dragData?.dragType) ||
      !state.dragData['end']
    )
      return ''
    return `${
      state.dragData['start'] <= iso && state.dragData['end'] >= iso
        ? 'bg-accent'
        : ''
    } ${state.dragData['end'] === iso ? 'rounded-b-lg' : ''} ${
      state.dragData['start'] === iso ? 'rounded-t-lg' : ''
    }`
  })

  const hourDisplay = useHourDisplay(hours)

  return (
    <div
      className={`group flex h-[16px] items-center justify-end ${selectedClassName}`}
      key={iso}
      {...attributes}
      {...listeners}
      ref={(node) => {
        setNodeRef(node)
        setDragNodeRef(node)
      }}
    >
      <hr
        className={`border-t border-faint ${
          isOver ? '!w-full' : 'active:!w-full'
        } ${
          type === 'hours'
            ? hours === 0
              ? 'w-16'
              : hours % 6 === 0
              ? 'w-8'
              : hours % 3 === 0
              ? 'w-4'
              : 'w-1'
            : minutes === 0
            ? hours % 12 === 0
              ? 'w-16'
              : hours % 3 === 0
              ? 'w-8'
              : 'w-4'
            : minutes % 30 === 0
            ? 'w-2'
            : 'w-1'
        }`}
      ></hr>

      <div className={`ml-1 flex-none font-menu text-xs text-muted w-4`}>
        {(type === 'minutes' && minutes === 0) ||
        (type === 'hours' && hours % 3 === 0)
          ? hourDisplay
          : ''}
      </div>
    </div>
  )
}

export function NowTime({ dragContainer }: { dragContainer: string }) {
  const startISO = toISO(roundMinutes(DateTime.now()))
  const { isOver, setNodeRef } = useDroppable({
    id: `${dragContainer}::now`,
    data: { scheduled: startISO } as DropData,
  })

  // const dragData: DragData = {
  //   dragType: 'now',
  // }
  // const {
  //   setNodeRef: setDragNodeRef,
  //   attributes,
  //   listeners,
  // } = useDraggable({
  //   data: dragData,
  //   id: `${dragContainer}::now`,
  // })

  const nowTime = roundMinutes(DateTime.now())
  const hourDisplay = useHourDisplay(nowTime.hour)

  return (
    <div
      className={`group flex w-full items-center rounded-lg pl-9 pr-2 hover:bg-selection transition-colors duration-300 ${
        isOver ? 'bg-selection' : ''
      }`}
      ref={setNodeRef}
    >
      {/* <div
        className='cursor-grab hidden group-hover:block text-xs ml-1 text-accent flex-none'
        // {...attributes}
        // {...listeners}
        // ref={setDragNodeRef}
      >
        Shift all
      </div> */}
      <div className='h-1 w-1 rounded-full bg-red-800'></div>
      <div className='w-full border-0 border-b border-solid border-red-800'></div>

      <div className='text-xs font-menu ml-2'>{`${hourDisplay}:${String(
        nowTime.minute
      ).padStart(2, '0')}`}</div>
    </div>
  )
}
