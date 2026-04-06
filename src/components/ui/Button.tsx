import * as React from "react"
import { cn } from "@/lib/utils/cn"

type ButtonIntent = "primary" | "secondary" | "ghost"
type ButtonSize = "md" | "lg"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: ButtonIntent
  size?: ButtonSize
  asChild?: boolean
}

const base =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50"

const intentStyles: Record<ButtonIntent, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-600 border border-white/10",
  secondary:
    "bg-white/5 text-white hover:bg-white/10 active:bg-white/5 border border-white/10",
  ghost: "bg-transparent text-white hover:bg-white/10 active:bg-transparent"
}

const sizeStyles: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base"
}

export function Button({
  className,
  intent = "primary",
  size = "md",
  asChild,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, intentStyles[intent], sizeStyles[size], className)

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>
    return React.cloneElement(child, {
      className: cn(child.props.className, classes)
    })
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}

