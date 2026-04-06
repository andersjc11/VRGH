import * as React from "react"
import { cn } from "@/lib/utils/cn"

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500",
        className
      )}
      {...props}
    />
  )
}

