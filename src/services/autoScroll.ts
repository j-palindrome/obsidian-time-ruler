import { useEffect, useRef } from 'react'
import { useAppStore } from '../app/store'
import $ from 'jquery'

export const useAutoScroll = (dragging: boolean) => {
  const dragRef = useRef<boolean>(dragging)
  dragRef.current = dragging
  const scrollAction = useRef<boolean | number>(false)
  const timeRulerBoundingRect = useRef<DOMRect | null>(null)
  const position = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const autoScroll = () => {
    if (!dragRef.current) return

    const SCROLL_TIME = 1000
    const WAIT_TIME = 500
    const MARGIN = 20

    const performScroll = (
      el: Element,
      scrollInfo: Partial<{ [key in 'left' | 'top']: number }>
    ) => {
      if (!dragRef.current) return

      $(el).css('scroll-snap-type', 'none')
      window.setTimeout(() => {
        $(el).css('scroll-snap-type', '')
      }, SCROLL_TIME)

      scrollAction.current = true
      window.setTimeout(() => {
        scrollAction.current = false
      }, SCROLL_TIME)

      el.scrollBy({
        ...scrollInfo,
        behavior: 'smooth',
      })
    }

    const prepareScroll = (
      el: Element,
      scrollInfo: Partial<{ [key in 'left' | 'top']: number }>
    ) => {
      if (!dragRef.current) return

      scrollAction.current = window.setTimeout(
        () => performScroll(el, scrollInfo),
        WAIT_TIME
      )
    }

    let continueAutoScroll = false
    const targets = document.elementsFromPoint(
      position.current.x,
      position.current.y
    )

    const yTargets = targets.filter(
      (el) => el.getAttribute('data-auto-scroll') === 'y'
    )
    for (let el of yTargets) {
      const rect = el.getBoundingClientRect()
      if (rect.top > position.current.y - MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { top: (rect.height - MARGIN) * -1 })
        continueAutoScroll = true
        break
      } else if (rect.bottom < position.current.y + MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { top: rect.height - MARGIN })
        continueAutoScroll = true
        break
      }
    }

    const xTargets = targets.filter(
      (el) => el.getAttribute('data-auto-scroll') === 'x'
    )
    for (let el of xTargets) {
      const rect = el.getBoundingClientRect()
      if (rect.left > position.current.x - MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { left: (rect.width - MARGIN) * -1 })
        continueAutoScroll = true
        break
      } else if (rect.right < position.current.x + MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { left: rect.width - MARGIN })
        continueAutoScroll = true
        break
      }
    }

    if (!continueAutoScroll && scrollAction.current) {
      if (typeof scrollAction.current === 'number')
        window.clearTimeout(scrollAction.current)
      scrollAction.current = false
    }

    if (dragRef.current) requestAnimationFrame(autoScroll)
  }

  const updateMousePosition = (ev: MouseEvent) => {
    if (!dragRef.current) return
    position.current.x = ev.clientX
    position.current.y = ev.clientY
  }

  useEffect(() => {
    if (dragging) {
      timeRulerBoundingRect.current =
        $('#time-ruler')[0].getBoundingClientRect()
      window.addEventListener('mousemove', updateMousePosition)
      autoScroll()
    } else {
      scrollAction.current = false
      window.removeEventListener('mousemove', updateMousePosition)
    }
  }, [dragging])
}
