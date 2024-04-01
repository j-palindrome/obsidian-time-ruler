import { Arguments } from '@dnd-kit/core/dist/components/Accessibility/types'
import $ from 'jquery'
import { Platform } from 'obsidian'
import { useEffect, useRef } from 'react'
import { useAppStore } from 'src/app/store'
import invariant from 'tiny-invariant'

export const useAutoScroll = () => {
  const dragging = useAppStore((state) => !!state.dragData)
  let scrolling = useRef<boolean>(false)
  let timeout = useRef<number | null>(null)
  const WAIT_TIME = 500

  useEffect(() => {
    const scrollBy = (el: HTMLElement, object: Record<string, number>) => {
      scrolling.current = true
      timeout.current = null
      el.scrollBy({ ...object, behavior: 'smooth' })
      setTimeout(() => {
        scrolling.current = false
      }, 750)
    }

    const autoScroll = (ev: MouseEvent | TouchEvent) => {
      if (scrolling.current) return
      let pos: { x: number; y: number } = { x: 0, y: 0 }
      if (ev instanceof TouchEvent) {
        pos.x = ev.touches[0].clientX
        pos.y = ev.touches[0].clientY
      } else if (ev instanceof MouseEvent) {
        pos.x = ev.clientX
        pos.y = ev.clientY
      }

      const tr = document.getElementById('time-ruler')
      invariant(tr)
      let found = false

      for (let el of tr.findAll('[data-auto-scroll="y"]')) {
        const { left, right, top, bottom, height } = el.getBoundingClientRect()
        if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom)
          continue
        const MARGIN = 10
        if (pos.y < top + MARGIN) {
          found = true
          if (!timeout.current)
            timeout.current = setTimeout(
              () => scrollBy(el, { top: -height }),
              WAIT_TIME
            )
          break
        } else if (pos.y > bottom - MARGIN) {
          found = true
          if (!timeout.current)
            timeout.current = setTimeout(
              () => scrollBy(el, { top: height }),
              WAIT_TIME
            )
          break
        }
      }
      if (!found) {
        for (let el of tr.findAll('[data-auto-scroll="x"]')) {
          const { left, width, top, bottom, right } = el.getBoundingClientRect()

          if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom)
            continue
          const MARGIN = 10
          if (pos.x < left + MARGIN) {
            found = true
            if (!timeout.current)
              timeout.current = setTimeout(
                () => scrollBy(el, { left: -width }),
                WAIT_TIME
              )
            break
          } else if (pos.x > right - MARGIN) {
            found = true
            if (!timeout.current)
              timeout.current = setTimeout(
                () => scrollBy(el, { left: width }),
                WAIT_TIME
              )
            break
          }
        }
      }

      if (!found && timeout.current) {
        clearTimeout(timeout.current)
        timeout.current = null
      }
    }

    if (dragging)
      window.addEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        autoScroll
      )
    return () => {
      window.removeEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        autoScroll
      )
    }
  }, [dragging])
}
