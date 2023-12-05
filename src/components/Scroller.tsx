import { useRef } from 'react'
import invariant from 'tiny-invariant'
import Button from './Button'

export default function Scroller({
  items,
  onSelect,
}: {
  items: string[]
  onSelect: (item: string) => void
}) {
  const lastScroll = useRef<number>(0)
  const frame = useRef<HTMLDivElement>(null)
  const scrolling = () => {
    invariant(frame.current)
    const scroll = Math.floor(
      frame.current.scrollTop / frame.current.clientHeight
    )
    if (scroll !== lastScroll.current) {
      lastScroll.current = scroll
      onSelect(items[scroll])
    }
  }
  const scrollTo = (mode: 1 | -1) => {
    invariant(frame.current)
    frame.current.scrollBy({ top: frame.current.clientHeight * mode })
  }
  return (
    <div className='flex items-center'>
      <Button src='chevron-left' onClick={() => scrollTo(-1)} />
      <div
        className='h-[24px] w-fit px-1 snap-y snap-mandatory font-menu rounded-lg overflow-y-auto no-scrollbar'
        ref={frame}
        onScroll={scrolling}
      >
        {items.map((item) => (
          <div key={item} className='h-full snap-start text-center'>
            {item}
          </div>
        ))}
      </div>
      <Button src='chevron-right' onClick={() => scrollTo(1)} />
    </div>
  )
}
