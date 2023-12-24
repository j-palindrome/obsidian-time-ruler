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
  noExtension,
  nested,
}: {
  startISO: string
  endISO: string
  chopEnd?: boolean
  chopStart?: boolean
  dragContainer: string
  noExtension?: boolean
  nested?: boolean
}) {
  const times: DateTime[] = []
  const givenStart = DateTime.fromISO(startISO)
  const givenEnd = DateTime.fromISO(endISO)
  const showingPastDates = useAppStore((state) => state.showingPastDates)
  const hideTimes = useAppStore((state) => state.settings.hideTimes)
  const calendarMode = useAppStore((state) => state.viewMode === 'week')
  const type: TimeSpanTypes = calendarMode ? 'hours' : 'minutes'
  if (hideTimes) return <></>

  let start = roundMinutes(givenStart)
  let end = roundMinutes(givenEnd)
  const dayEnd = useAppStore((state) => state.settings.dayStartEnd[1])
  let dayEndTime = start.set({ hour: dayEnd })
  if (dayEnd < 12 && end.get('hour') >= dayEnd)
    dayEndTime = dayEndTime.plus({ days: 1 })

  const now = roundMinutes(DateTime.now())
  if (showingPastDates) {
    start = DateTime.min(now, start)
    end = DateTime.min(now, end)
  } else {
    start = DateTime.max(now, start)
    end = DateTime.max(now, end)
  }
  end = DateTime.min(end, dayEndTime)

  const modifier: { [K in TimeSpanTypes]: Parameters<DateTime['plus']>[0] } = {
    minutes: { minutes: 15 },
    hours: { hours: 1 },
  }

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
    <div className={`group flex h-[16px] items-center justify-end`} key={iso}>
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
          className={`${
            isOver ? 'border-accent border-t-2' : 'border-faint border-t'
          } ${
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
          className={`ml-1 h-full flex-none font-menu text-xs w-4 ${
            isOver ? 'text-accent' : 'text-muted'
          }`}
        >
          {(type === 'minutes' && minutes === 0) ||
          (type === 'hours' && hours % 3 === 0)
            ? hourDisplay
            : isOver
            ? minutes > 0
              ? ':' + minutes
              : hours
            : ''}
        </div>
      </div>
    </div>
  )
}

export function NowTime({ dragContainer }: { dragContainer: string }) {
  const startISO = toISO(roundMinutes(DateTime.now()))
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: `${dragContainer}::now::drop`,
    data: { scheduled: startISO } as DropData,
  })

  const dragData: DragData = {
    dragType: 'now',
  }

  const nowTime = roundMinutes(DateTime.now())
  const hourDisplay = useHourDisplay(nowTime.hour)

  return (
    <div
      className={`group flex w-full items-center rounded-lg pl-9 pr-2 hover:bg-selection transition-colors duration-300 ${
        isOver ? 'bg-selection' : ''
      }`}
      ref={(node) => {
        setDropNodeRef(node)
      }}
    >
      <div className='h-1 w-1 rounded-full bg-red-800'></div>
      <div className='w-full border-0 border-b border-solid border-red-800'></div>

      <div className='text-xs font-menu ml-2'>{`${hourDisplay}:${String(
        nowTime.minute
      ).padStart(2, '0')}`}</div>
    </div>
  )
}
