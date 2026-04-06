import * as React from "react"
import { cn } from "@/lib/utils/cn"

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

