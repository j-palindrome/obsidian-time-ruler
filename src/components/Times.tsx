import { useDroppable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { roundMinutes } from '../services/util'

export type TimeSpanTypes = 'minutes' | 'hours' | 'days'
export default function Times({
  startISO,
  endISO,
  type = 'minutes',
  chopEnd,
  chopStart,
  due
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  chopEnd?: boolean
  chopStart?: boolean
  due?: boolean
}) {
  const times: DateTime[] = []
  const givenStart = DateTime.fromISO(startISO)
  let start = roundMinutes(DateTime.max(givenStart, DateTime.now()))
  let end = roundMinutes(DateTime.fromISO(endISO))
  const modifier: { [K in TimeSpanTypes]: Parameters<DateTime['plus']>[0] } = {
    minutes: { minutes: 15 },
    hours: { hours: 1 },
    days: { days: 1 }
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
      {times.map(time => (
        <Time key={time.toISO()} {...{ type, time, due }} />
      ))}
    </div>
  )
}

export type TimeProps = { time: DateTime; type: TimeSpanTypes; due?: boolean }
function Time({ time, type, due }: TimeProps) {
  const minutes = time.minute
  const hours = time.hour
  const day = time.weekday
  const date = time.day
  const iso = time.toISO({
    includeOffset: false,
    suppressMilliseconds: true,
    suppressSeconds: true
  }) as string

  const { isOver, setNodeRef } = useDroppable({
    id: iso + (due ? '::due' : '::scheduled'),
    data: due ? { due: iso } : ({ scheduled: iso } as DropData)
  })

  return (
    <div
      className={`flex h-[16px] items-center justify-end`}
      key={time.toISO()}
      ref={setNodeRef}
      onMouseUp={() => {}}>
      <hr
        className={`border-t border-faint ${
          isOver ? '!w-full' : 'active:w-full'
        } ${
          type === 'days'
            ? day === 1
              ? date < 7
                ? 'w-16'
                : 'w-8'
              : day === 5
              ? 'w-4'
              : 'w-1'
            : type === 'hours'
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
        }`}></hr>
      <div
        className={`ml-1 flex-none font-menu text-xs text-muted ${
          type === 'days' ? 'w-8' : 'w-4'
        }`}>
        {type === 'days'
          ? [1, 5].includes(day)
            ? `${time.month}/${date}`
            : ''
          : type === 'hours'
          ? [12, 0].includes(hours)
            ? '12'
            : hours % 3 === 0
            ? hours % 12
            : ''
          : minutes === 0
          ? hours === 0
            ? '12'
            : hours === 12
            ? '12'
            : hours % 12
          : ''}
      </div>
    </div>
  )
}
