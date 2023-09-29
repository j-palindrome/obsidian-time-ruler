import { useDroppable } from '@dnd-kit/core'
import { cloneElement } from 'react'

export default function Droppable({
  children,
  id,
  data,
  ref,
}: {
  children: JSX.Element
  id: string
  data: DropData
  ref?: (element: HTMLElement | null) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data,
  })

  return cloneElement(children, {
    ref: ref
      ? (node) => {
          ref(node)
          setNodeRef(node)
        }
      : setNodeRef,
    className: `${children.props.className} rounded-lg ${
      isOver ? '!bg-selection' : ''
    }`,
  })
}
