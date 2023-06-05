import { setIcon } from 'obsidian'
import { useLayoutEffect, useRef } from 'react'
import invariant from 'tiny-invariant'

export default function Logo({ src, className = '', title = '' }) {
  const frame = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    invariant(frame.current)
    setIcon(frame.current, src)
  }, [src])

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className} ${
        !className.includes('h-') ? 'h-full' : ''
      } ${!className.includes('w-') ? 'w-full' : ''}`}
      ref={frame}
    ></div>
  )
}
