import { useDraggable, useDroppable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { useEffect } from 'react'
import { getters, setters, useAppStore } from '../app/store'
import {
  isLengthType,
  roundMinutes,
  toISO,
  useHourDisplay,
} from '../services/util'

export type TimeSpanTypes = 'minutes' | 'hours'
export default function Minutes({
  startISO,
  endISO,
  chopEnd,
  chopStart,
  dragContainer,
}: {
  startISO: string
  endISO: string
  chopEnd?: boolean
  chopStart?: boolean
  dragContainer: string
}) {
  const dayEnd = useAppStore((state) => state.settings.dayStartEnd[1])

  const times: DateTime[] = []
  const givenStart = DateTime.fromISO(startISO)
  const givenEnd = DateTime.fromISO(endISO)
  const type: TimeSpanTypes = useAppStore((state) =>
    state.settings.viewMode === 'week' ? 'hours' : 'minutes'
  )

  let start = roundMinutes(givenStart)
  let end = roundMinutes(givenEnd)

  let dayEndTime = start.set({ hour: dayEnd })
  if (dayEnd < 12 && start.get('hour') >= dayEnd)
    dayEndTime = dayEndTime.plus({ days: 1 })

  const now = roundMinutes(DateTime.now())
  end = DateTime.min(end, dayEndTime)

  const modifier: { [K in TimeSpanTypes]: Parameters<DateTime['plus']>[0] } = {
    minutes: { minutes: 15 },
    hours: { hours: 1 },
  }

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
    <div>
      {times.map((time, i) => (
        <Time key={startISOs[i]} {...{ type, time, dragContainer }} />
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
        ? 'border-0 border-l-2 border-solid border-l-accent'
        : ''
    }`
  })

  const hourDisplay = useHourDisplay(hours)

  return (
    <div
      className={`flex h-[16px] items-center justify-end relative`}
      key={iso}
    >
      <div
        className={`flex text-sm absolute right-12 h-4 items-center bg-selection rounded-icon px-2 text-accent !z-50 justify-center ${
          isOver ? 'block' : 'hidden'
        }`}
      >
        {hours}:{String(minutes).padStart(2, '0')}
      </div>
      <div
        className={`w-10 h-full flex flex-none items-center justify-end ${selectedClassName}`}
        {...attributes}
        {...listeners}
        ref={(node) => {
          setNodeRef(node)
          setDragNodeRef(node)
        }}
      >
        <hr
          className={`my-0 border-0 border-t hover:border-accent border-faint ${
            type === 'hours'
              ? hours % 6 === 0
                ? 'w-6'
                : hours % 3 === 0
                ? 'w-4'
                : 'w-1'
              : minutes === 0
              ? hours % 3 === 0
                ? 'w-6'
                : 'w-4'
              : minutes % 30 === 0
              ? 'w-2'
              : 'w-1'
          }`}
        ></hr>
        <div
          className={`ml-1 h-full flex-none font-menu text-xs w-4 hover:text-accent text-muted`}
        >
          {(type === 'minutes' && minutes === 0) ||
          (type === 'hours' && hours % 3 === 0)
            ? hourDisplay
            : ''}
        </div>
      </div>
    </div>
  )
}
