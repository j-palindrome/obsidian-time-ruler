import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'
import { useStopwatch, useTimer } from 'react-timer-hook'
import Button from './Button'
import Block from './Block'
import { useAppStore } from '../app/store'
import _ from 'lodash'
import { isDateISO, processLength, toISO } from '../services/util'
import { shallow } from 'zustand/shallow'
import Event from './Event'
import invariant from 'tiny-invariant'
import Timeline from './Timeline'
import { sounds } from '../assets/assets'

export function Timer() {
  const pauseExpiration = useRef(true)
  const [negative, setNegative] = useState(false)
  const muted = useAppStore((state) => state.settings.muted)

  const timer = useTimer({
    expiryTimestamp: new Date(),
    onExpire: () => {
      if (pauseExpiration.current) return
      setMaxSeconds(null)
      setInput('')
      try {
        new Notification('timer complete')
        if (!muted) sounds.timer.play()
      } catch (err) {}
      timer.pause()
      stopwatch.start()
      setNegative(true)
    },
    autoStart: false,
  })

  const stopwatch = useStopwatch({ autoStart: false })

  useEffect(() => {
    pauseExpiration.current = false
  }, [])

  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [maxSeconds, setMaxSeconds] = useState<number | null>(null)
  const seconds = maxSeconds ? timer.seconds : stopwatch.seconds
  const minutes = maxSeconds ? timer.minutes : stopwatch.minutes
  const hours = maxSeconds ? timer.hours : stopwatch.hours
  const playing = timer.isRunning || stopwatch.isRunning

  const currentTime = maxSeconds ? timer.totalSeconds : stopwatch.totalSeconds

  const start = () => {
    setNegative(false)
    let hours = 0
    let minutes = 0
    if (!input) {
      setMaxSeconds(null)
      stopwatch.start()
    } else {
      if (input.includes(':')) {
        const split = input.split(':').map((x) => parseInt(x))
        hours = split[0]
        minutes = split[1]
      } else {
        minutes = parseInt(input)
      }
      setMaxSeconds(minutes * 60 + hours * 60 * 60)
      timer.restart(DateTime.now().plus({ minutes, hours }).toJSDate())
    }
    playSound()
  }

  let width = 0
  if (!maxSeconds) {
    const CYCLE_SEC = 60
    const modulus = (currentTime % CYCLE_SEC) / CYCLE_SEC
    width = modulus * 100
  } else {
    width = (currentTime / maxSeconds) * 100
  }

  const change: React.ChangeEventHandler<HTMLInputElement> = (ev) => {
    if (/\d*(:\d*)?/.test(ev.target.value)) {
      setInput(ev.target.value)
    }
  }

  const playSound = () => {
    if (!playing && !muted) {
      sounds.start.play()
    }
  }

  const togglePlaying = () => {
    if (currentTime <= 0) start()
    else {
      playing
        ? maxSeconds
          ? timer.pause()
          : stopwatch.pause()
        : maxSeconds
        ? timer.resume()
        : stopwatch.start()
      playSound()
    }
  }

  const reset = () => {
    setNegative(false)
    if (maxSeconds) {
      setMaxSeconds(null)
      timer.restart(new Date(), false)
    } else {
      stopwatch.reset(undefined, false)
    }
    setInput('')
  }

  const addTime = (minutes: number) => {
    if (maxSeconds) {
      setMaxSeconds(maxSeconds + minutes * 60)
      const currentTime = DateTime.now()
        .plus({ minutes: timer.minutes, hours: timer.hours })
        .plus({ minutes: minutes })
      timer.restart(currentTime.toJSDate(), true)
    } else {
      const currentTime = DateTime.now()
        .plus({ minutes: stopwatch.minutes, hours: stopwatch.hours })
        .plus({ minutes: minutes })
      stopwatch.reset(currentTime.toJSDate(), true)
    }
  }

  return (
    <div
      className={`${
        expanded
          ? 'fixed left-0 top-0 z-40 flex h-full w-full flex-col bg-primary p-4'
          : 'w-full'
      }`}
    >
      <div
        className={`relative my-1 flex w-full items-center justify-center rounded-icon bg-primary-alt font-menu text-sm child:relative child:h-full py-0.5 ${
          negative ? 'bg-red-800/50' : ''
        } ${expanded ? 'h-12' : 'h-6'}`}
      >
        <div
          className={`!absolute left-0 top-0 h-full flex-none rounded-icon ${
            width === 0 ? '' : 'transition-width duration-1000 ease-linear'
          } ${negative ? 'bg-red-500/20' : 'bg-selection'}`}
          style={{
            width: `${width}%`,
          }}
        ></div>

        {!playing && currentTime <= 0 ? (
          <input
            type='number'
            value={input}
            placeholder={'mins'}
            onKeyDown={(ev) => ev.key === 'Enter' && start()}
            onChange={change}
            className='w-[4em] !border-none bg-transparent text-center !shadow-none'
          ></input>
        ) : (
          <pre className='my-0 mr-1 !h-fit'>{`${negative ? '-' : ''}${
            hours > 0 ? hours + ':' : ''
          }${hours > 0 ? String(minutes).padStart(2, '0') : minutes}:${String(
            seconds
          ).padStart(2, '0')}`}</pre>
        )}
        <Button
          className='p-0.5'
          onClick={togglePlaying}
          src={playing ? 'pause' : 'play'}
          title={'timer or stopwatch'}
        />
        {playing && (
          <>
            <Button onClick={() => addTime(5)}>+5</Button>
            <Button onClick={() => addTime(-5)}>-5</Button>
          </>
        )}
        {!playing && currentTime > 0 && (
          <Button onClick={reset} src='rotate-cw' className='p-0.5' />
        )}
        <Button
          onClick={() => setExpanded(!expanded)}
          src={expanded ? 'minimize-2' : 'maximize-2'}
        />
      </div>
      {expanded && (
        <div className='relative h-full w-full space-y-2 overflow-y-auto py-2 text-base child:max-w-xl flex justify-center'>
          <Timeline
            dragContainer='timer'
            startISO={DateTime.now().toISODate() as string}
            endISO={toISO(DateTime.now())}
            hideTimes
            type='minutes'
          />
        </div>
      )}
    </div>
  )
}
