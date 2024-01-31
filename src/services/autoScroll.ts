import { Arguments } from '@dnd-kit/core/dist/components/Accessibility/types'
import $ from 'jquery'
import { Platform } from 'obsidian'
import { useEffect, useRef } from 'react'
import { useAppStore } from 'src/app/store'
import invariant from 'tiny-invariant'

// const useAutoScroll = (dragging: boolean) => {
//   const dragRef = useRef<boolean>(dragging)
//   dragRef.current = dragging
//   const scrollAction = useRef<boolean | number>(false)
//   const timeRulerBoundingRect = useRef<DOMRect | null>(null)
//   const position = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

//   const autoScroll = () => {
//     if (!dragRef.current) return

//     const SCROLL_TIME = 1000
//     const WAIT_TIME = 500
//     const MARGIN = 15

//     type ScrollInfo = { type: 'left' | 'top' | 'section'; value: number }
//     const performScroll = (el: Element, scrollInfo: ScrollInfo) => {
//       if (!dragRef.current) return

//       $(el).css('scroll-snap-type', 'none')
//       el.win.setTimeout(() => {
//         $(el).css('scroll-snap-type', '')
//       }, SCROLL_TIME)

//       scrollAction.current = true
//       el.win.setTimeout(() => {
//         scrollAction.current = false
//       }, SCROLL_TIME)

//       switch (scrollInfo.type) {
//         case 'top':
//           el.scrollBy({
//             top: scrollInfo.value,
//             behavior: 'smooth',
//           })
//           break
//         case 'left':
//           el.scrollBy({
//             left: scrollInfo.value,
//             behavior: 'smooth',
//           })
//           break
//         case 'section':
//           $(el).children()[scrollInfo.value]?.scrollIntoView({
//             inline: 'start',
//             behavior: 'smooth',
//           })
//           break
//       }
//     }

//     const prepareScroll = (el: Element, scrollInfo: ScrollInfo) => {
//       if (!dragRef.current) return

//       scrollAction.current = window.setTimeout(
//         () => performScroll(el, scrollInfo),
//         WAIT_TIME
//       )
//     }

//     const cancelScroll = () => {
//       if (typeof scrollAction.current === 'number')
//         window.clearTimeout(scrollAction.current)
//       scrollAction.current = false
//     }

//     let continueAutoScroll = false
//     const targets = document.elementsFromPoint(
//       position.current.x,
//       position.current.y
//     )

//     const yTargets = targets.filter(
//       (el) => el.getAttribute('data-auto-scroll') === 'y'
//     )
//     for (let el of yTargets) {
//       const rect = el.getBoundingClientRect()
//       if (rect.top > position.current.y - MARGIN) {
//         if (!scrollAction.current)
//           prepareScroll(el, {
//             type: 'top',
//             value: (rect.height - MARGIN * 2) * -1,
//           })
//         continueAutoScroll = true
//         break
//       } else if (rect.bottom < position.current.y + MARGIN) {
//         if (!scrollAction.current)
//           prepareScroll(el, { type: 'top', value: rect.height - MARGIN * 2 })
//         continueAutoScroll = true
//         break
//       }
//     }

//     const xTargets = targets.filter(
//       (el) => el.getAttribute('data-auto-scroll') === 'x'
//     )
//     for (let el of xTargets) {
//       const rect = el.getBoundingClientRect()
//       if (rect.left > position.current.x - MARGIN) {
//         if (!scrollAction.current)
//           prepareScroll(el, {
//             type: 'left',
//             value: rect.width * -1,
//           })
//         continueAutoScroll = true
//         break
//       } else if (rect.right < position.current.x + MARGIN) {
//         if (!scrollAction.current)
//           prepareScroll(el, { type: 'left', value: rect.width })
//         continueAutoScroll = true
//         break
//       }
//     }

//     if (!continueAutoScroll && scrollAction.current) {
//       cancelScroll()
//     }

//     if (dragRef.current) requestAnimationFrame(autoScroll)
//   }

//   const updateMousePosition = (ev: MouseEvent | TouchEvent) => {
//     if (!dragRef.current) return
//     if (ev instanceof TouchEvent) {
//       position.current.x = ev.touches[0].clientX
//       position.current.y = ev.touches[0].clientY
//     } else if (ev instanceof MouseEvent) {
//       position.current.x = ev.clientX
//       position.current.y = ev.clientY
//     }
//   }

//   useEffect(() => {
//     if (dragging) {
//       timeRulerBoundingRect.current =
//         $('#time-ruler')[0].getBoundingClientRect()
//       window.addEventListener(
//         Platform.isMobile ? 'touchmove' : 'mousemove',
//         updateMousePosition
//       )

//       autoScroll()
//     } else {
//       scrollAction.current = false
//       window.removeEventListener(
//         Platform.isMobile ? 'touchmove' : 'mousemove',
//         updateMousePosition
//       )
//     }
//   }, [dragging])
// }

export const useAutoScroll = () => {
  const dragging = useAppStore((state) => !!state.dragData)
  let scrolling = useRef<boolean>(false)
  let timeout = useRef<number | null>(null)
  const WAIT_TIME = 500

  useEffect(() => {
    const scrollBy = (el: HTMLElement, object: Record<string, number>) => {
      scrolling.current = true
      el.scrollBy({ ...object, behavior: 'smooth' })
      setTimeout(() => {
        scrolling.current = false
        timeout.current = null
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

      for (let el of tr.findAll('[data-auto-scroll]')) {
        const { left, top, right, bottom, width, height } =
          el.getBoundingClientRect()

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
        } else if (pos.y < top + MARGIN) {
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
