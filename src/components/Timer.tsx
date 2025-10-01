import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'
import { useStopwatch, useTimer } from 'react-timer-hook'
import { getters, setters, useAppStore } from '../app/store'
import { sounds } from '../assets/assets'
import Button from './Button'
import { CapacitorAdapter, Notice } from 'obsidian'

export function Timer() {
  const pauseExpiration = useRef(true)
  const { negative, startISO, maxSeconds, playing } = useAppStore(
    (state) => state.timer
  )
  const muted = useAppStore((state) => state.settings.muted)

  const timer = useTimer({
    expiryTimestamp: startISO ? new Date(startISO) : new Date(),
    onExpire: () => {
      if (pauseExpiration.current) return
      setInput('')
      timer.pause()
      stopwatch.totalSeconds = 0
      stopwatch.start()
    },
    autoStart: false,
  })

  const stopwatch = useStopwatch({
    autoStart: false,
    offsetTimestamp: startISO ? new Date(startISO) : new Date(),
  })

  useEffect(() => {
    pauseExpiration.current = false
    if (!startISO) return
    if (playing && maxSeconds) timer.restart(new Date(startISO), true)
    else if (playing) {
      const seconds = DateTime.now()
        .diff(DateTime.fromISO(startISO))
        .shiftTo('seconds').seconds
      stopwatch.reset(DateTime.now().plus({ seconds }).toJSDate(), true)
    }
  }, [])

  useEffect(() => {
    const newPlaying = stopwatch.isRunning || timer.isRunning
    if (newPlaying !== playing) setters.patchTimer({ playing: newPlaying })
  }, [stopwatch.isRunning, timer.isRunning])

  const [input, setInput] = useState('')
  const seconds = maxSeconds ? timer.seconds : stopwatch.seconds
  const minutes = maxSeconds ? timer.minutes : stopwatch.minutes
  const hours = maxSeconds ? timer.hours : stopwatch.hours
  const currentTime = maxSeconds ? timer.totalSeconds : stopwatch.totalSeconds

  const start = () => {
    setters.patchTimer({ negative: false })
    let hours = 0
    let minutes = 0
    if (!input) {
      setters.patchTimer({
        maxSeconds: null,
        startISO: new Date().toISOString(),
      })
      stopwatch.start()
    } else {
      if (input.includes(':')) {
        const split = input.split(':').map((x) => parseInt(x))
        hours = split[0]
        minutes = split[1]
      } else {
        minutes = parseFloat(input)
      }
      const endDate = DateTime.now().plus({ minutes, hours }).toJSDate()
      timer.restart(endDate)
      setters.patchTimer({
        maxSeconds: minutes * 60 + hours * 60 * 60,
        startISO: endDate.toISOString(),
      })

      if (getters.getApp().isMobile) {
        try {
          // @ts-ignore
          Capacitor.registerPlugin('LocalNotifications')
          // @ts-ignore
          const localNotifications = Capacitor.Plugins.localNotifications
          // LocalNotifications.unscheduled()
          localNotifications.schedule({
            notifications: [
              {
                title: 'Timer complete',
                id: 1,
                schedule: {
                  at: endDate,
                },
              },
            ],
          })
        } catch (error) {
          new Notice(error.message)
        }
      }
    }
    playSound()
  }

  const reset = () => {
    setters.patchTimer({ negative: false })
    if (maxSeconds) {
      setters.patchTimer({
        maxSeconds: null,
      })
      timer.restart(new Date(), false)
    } else {
      stopwatch.reset(undefined, false)
    }
    setInput('')
  }

  const addTime = (minutes: number) => {
    if (maxSeconds) {
      const currentTime = DateTime.now()
        .plus({ seconds: timer.totalSeconds })
        .plus({ minutes: minutes })
      timer.restart(currentTime.toJSDate(), true)
      setters.patchTimer({
        maxSeconds: maxSeconds + minutes * 60,
        startISO: currentTime.toJSDate().toISOString(),
      })
    } else {
      const currentTime = DateTime.now()
        .plus({
          seconds: stopwatch.totalSeconds,
        })
        .plus({ minutes: minutes })
      stopwatch.reset(currentTime.toJSDate(), true)
      setters.patchTimer({ startISO: currentTime.toJSDate().toISOString() })
    }
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

  const borders = useAppStore((state) => state.settings.borders)

  return (
    <div
      className={`relative my-1 flex w-full items-center justify-center rounded-icon font-menu text-sm child:relative child:h-full py-0.5 h-12 flex-none ${
        borders ? 'border-solid border-divider border-[1px]' : ''
      } ${negative ? 'bg-red-800/50' : 'bg-code'}`}
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
    </div>
  )
}
