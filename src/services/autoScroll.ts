import $ from 'jquery'
import { Platform } from 'obsidian'
import { useEffect, useRef } from 'react'

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

    type ScrollInfo = { type: 'left' | 'top' | 'section'; value: number }
    const performScroll = (el: Element, scrollInfo: ScrollInfo) => {
      if (!dragRef.current) return

      $(el).css('scroll-snap-type', 'none')
      el.win.setTimeout(() => {
        $(el).css('scroll-snap-type', '')
      }, SCROLL_TIME)

      scrollAction.current = true
      el.win.setTimeout(() => {
        scrollAction.current = false
      }, SCROLL_TIME)

      switch (scrollInfo.type) {
        case 'top':
          el.scrollBy({
            top: scrollInfo.value,
            behavior: 'smooth'
          })
          break
        case 'left':
          el.scrollBy({
            left: scrollInfo.value,
            behavior: 'smooth'
          })
          break
        case 'section':
          $(el).children()[scrollInfo.value]?.scrollIntoView({
            inline: 'start',
            behavior: 'smooth'
          })
          break
      }
    }

    const prepareScroll = (el: Element, scrollInfo: ScrollInfo) => {
      if (!dragRef.current) return

      scrollAction.current = window.setTimeout(
        () => performScroll(el, scrollInfo),
        WAIT_TIME
      )
    }

    const cancelScroll = () => {
      if (typeof scrollAction.current === 'number')
        window.clearTimeout(scrollAction.current)
      scrollAction.current = false
    }

    let continueAutoScroll = false
    const targets = document.elementsFromPoint(
      position.current.x,
      position.current.y
    )

    const yTargets = targets.filter(
      el => el.getAttribute('data-auto-scroll') === 'y'
    )
    for (let el of yTargets) {
      const rect = el.getBoundingClientRect()
      if (rect.top > position.current.y - MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, {
            type: 'top',
            value: (rect.height - MARGIN * 2) * -1
          })
        continueAutoScroll = true
        break
      } else if (rect.bottom < position.current.y + MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { type: 'top', value: rect.height - MARGIN * 2 })
        continueAutoScroll = true
        break
      }
    }

    const xTargets = targets.filter(
      el => el.getAttribute('data-auto-scroll') === 'x'
    )
    for (let el of xTargets) {
      const rect = el.getBoundingClientRect()
      if (rect.left > position.current.x - MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, {
            type: 'left',
            value: (rect.width - MARGIN * 2) * -1
          })
        continueAutoScroll = true
        break
      } else if (rect.right < position.current.x + MARGIN) {
        if (!scrollAction.current)
          prepareScroll(el, { type: 'left', value: rect.width - MARGIN * 2 })
        continueAutoScroll = true
        break
      }
    }

    const sectionButtonTarget = targets.find(el =>
      el.getAttribute('data-section-scroll')
    )
    if (sectionButtonTarget) {
      if (!scrollAction.current)
        prepareScroll($('#time-ruler-times')[0] as HTMLDivElement, {
          type: 'section',
          value: parseInt(
            sectionButtonTarget.getAttribute('data-section-scroll') as string
          )
        })
      continueAutoScroll = true
    }

    if (!continueAutoScroll && scrollAction.current) {
      cancelScroll()
    }

    if (dragRef.current) requestAnimationFrame(autoScroll)
  }

  const updateMousePosition = (ev: MouseEvent | TouchEvent) => {
    if (!dragRef.current) return
    if (ev instanceof TouchEvent) {
      position.current.x = ev.touches[0].clientX
      position.current.y = ev.touches[0].clientY
    } else if (ev instanceof MouseEvent) {
      position.current.x = ev.clientX
      position.current.y = ev.clientY
    }
  }

  useEffect(() => {
    if (dragging) {
      timeRulerBoundingRect.current =
        $('#time-ruler')[0].getBoundingClientRect()
      window.addEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        updateMousePosition
      )

      autoScroll()
    } else {
      scrollAction.current = false
      window.removeEventListener(
        Platform.isMobile ? 'touchmove' : 'mousemove',
        updateMousePosition
      )
    }
  }, [dragging])
}
