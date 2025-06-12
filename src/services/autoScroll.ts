import { Arguments } from '@dnd-kit/core/dist/components/Accessibility/types'
import $ from 'jquery'
import { Platform } from 'obsidian'
import { useEffect, useRef } from 'react'
import { useAppStore } from 'src/app/store'
import invariant from 'tiny-invariant'
import { scrollToSection } from './util'

export const useAutoScroll = () => {
  const dragging = useAppStore((state) => !!state.dragData)
  let scrolling = useRef<boolean>(false)
  let timeout = useRef<number | null>(null)
  let savedTimeoutObject = useRef<HTMLElement | null>(null)
  const WAIT_TIME = 500

  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const clearTimeout = () => {
    if (timeout.current) window.clearTimeout(timeout.current)
    timeout.current = null
    savedTimeoutObject.current = null
  }

  useEffect(() => {
    const scrollToDate = (dateButton: HTMLElement) => {
      scrolling.current = true
      clearTimeout()

      scrollToSection(dateButton.getAttr('data-date-button')!)

      window.setTimeout(() => {
        scrolling.current = false
      }, 750)
    }

    // Update position from the event
    const updatePosition = (ev: MouseEvent | TouchEvent) => {
      if (ev instanceof TouchEvent) {
        posRef.current.x = ev.touches[0].clientX
        posRef.current.y = ev.touches[0].clientY
      } else if (ev instanceof MouseEvent) {
        posRef.current.x = ev.clientX
        posRef.current.y = ev.clientY
      }
    }
    function checkScroll() {
      if (dragging) {
        autoScroll()
        animationFrameId = requestAnimationFrame(checkScroll)
      }
    }
    // Use requestAnimationFrame for the actual scrolling logic
    let animationFrameId = requestAnimationFrame(checkScroll)

    // Clean up the animation frame on unmount

    const autoScroll = () => {
      if (scrolling.current) return

      const tr = document.getElementById('time-ruler')
      invariant(tr)
      let found = false
      const SPEED = 5
      const pos = posRef.current

      // If no date button found, check for vertical scroll
      if (!found) {
        for (let el of tr.findAll('[data-auto-scroll="y"]')) {
          const { left, right, top, bottom, height } =
            el.getBoundingClientRect()
          if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom)
            continue
          const MARGIN = 20
          if (pos.y < top + MARGIN) {
            found = true
            if (savedTimeoutObject.current !== el) {
              clearTimeout()
              el.scrollBy({ top: -SPEED, behavior: 'instant' })
            }
            break
          } else if (pos.y > bottom - MARGIN) {
            found = true
            if (savedTimeoutObject.current !== el) {
              clearTimeout()
              el.scrollBy({ top: SPEED, behavior: 'instant' })
            }
            break
          }
        }
      }

      if (!found) {
        for (let el of tr.findAll('[data-auto-scroll="x"]')) {
          const { left, width, top, bottom, right } = el.getBoundingClientRect()

          if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom)
            continue
          const MARGIN = 20
          if (pos.x < left + MARGIN) {
            found = true
            if (savedTimeoutObject.current !== el) {
              clearTimeout()
              el.scrollBy({ left: -30, behavior: 'smooth' })
            }
            break
          } else if (pos.x > right - MARGIN) {
            found = true
            if (savedTimeoutObject.current !== el) {
              clearTimeout()
              el.scrollBy({ left: 30, behavior: 'smooth' })
            }
            break
          }
        }
      }

      if (!found) {
        // Check for date buttons first
        const dateButtons = tr.findAll('[data-date-button]')
        for (let button of dateButtons) {
          const { left, right, top, bottom } = button.getBoundingClientRect()

          if (
            pos.x >= left &&
            pos.x <= right &&
            pos.y >= top &&
            pos.y <= bottom
          ) {
            found = true
            if (savedTimeoutObject.current !== button) {
              clearTimeout()
              savedTimeoutObject.current = button
              timeout.current = setTimeout(() => {
                scrollToDate(button)
              }, WAIT_TIME * 2)
            }
            break
          }
        }
      }

      if (!found) {
        clearTimeout()
      }
    }

    if (dragging)
      window.addEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        updatePosition
      )

    return () => {
      window.removeEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        updatePosition
      )
      cancelAnimationFrame(animationFrameId)
      clearTimeout()
    }
  }, [dragging])
}
