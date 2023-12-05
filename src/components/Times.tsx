import { useDraggable, useDroppable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { isLengthType, roundMinutes } from '../services/util'
import ObsidianAPI from '../services/obsidianApi'
import { getters, setters, useAppStore } from '../app/store'
import Button from './Button'
import Droppable from './Droppable'
import { useEffect } from 'react'

export type TimeSpanTypes = 'minutes' | 'hours'
export default function Times({
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
  if (chopStart) start = start.plus(modifier[type])
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

  return (
    <div className={`min-h-[4px]`}>
      {times.map((time) => (
        <Time key={time.toISO()} {...{ type, time, dragContainer }} />
      ))}
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
  const iso = time.toISO({
    includeOffset: false,
    suppressMilliseconds: true,
    suppressSeconds: true,
  }) as string

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

  const twentyFourHourFormat = useAppStore(
    (state) => state.settings.twentyFourHourFormat
  )

  const hourDisplay = twentyFourHourFormat
    ? hours
    : [12, 0].includes(hours)
    ? '12'
    : hours % 12

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
