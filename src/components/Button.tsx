import { forwardRef } from 'react'
import Logo from './Logo'

const Button = forwardRef<
  HTMLDivElement,
  {
    className?: string
    src?: string
  } & React.ButtonHTMLAttributes<HTMLElement>
>(({ className, src, children, ...rest }, ref) => {
  return (
    <div
      className={`clickable-icon whitespace-nowrap font-menu text-sm ${className}`}
      {...rest}
      ref={ref}>
      {src ? <Logo src={src} /> : children ?? null}
    </div>
  )
})

export default Button
