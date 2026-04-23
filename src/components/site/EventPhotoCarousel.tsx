"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

export type EventPhotoCarouselItem = {
  src: string
  alt: string
}

export function EventPhotoCarousel({
  items,
  intervalMs = 3000
}: {
  items: EventPhotoCarouselItem[]
  intervalMs?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const isInViewRef = useRef(false)
  const pausedRef = useRef(false)
  const resumeTimeoutRef = useRef<number | null>(null)

  const pauseTemporarily = (durationMs = 4000) => {
    pausedRef.current = true
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current)
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false
      resumeTimeoutRef.current = null
    }, durationMs)
  }

  const scrollToIndex = (nextIndex: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const children = Array.from(viewport.children) as HTMLElement[]
    const target = children[nextIndex]
    if (!target) return
    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const left = targetRect.left - viewportRect.left + viewport.scrollLeft
    viewport.scrollTo({ left, behavior: "smooth" })
    setIndex(nextIndex)
  }

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (typeof window === "undefined") return
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.2
      },
      { threshold: [0, 0.2, 0.5] }
    )
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (items.length < 2) return
    if (typeof window === "undefined") return

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    if (reduceMotion) return

    const intervalId = window.setInterval(() => {
      if (pausedRef.current) return
      if (!isInViewRef.current) return
      const nextIndex = (indexRef.current + 1) % items.length
      scrollToIndex(nextIndex)
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = null
      }
    }
  }, [items.length, intervalMs])

  const canPrev = index > 0
  const canNext = index < items.length - 1

  return (
    <div className="mt-8">
      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={() => {
          pausedRef.current = true
        }}
        onMouseLeave={() => {
          pausedRef.current = false
        }}
        onPointerDown={() => pauseTemporarily()}
        onFocusCapture={() => {
          pausedRef.current = true
        }}
        onBlurCapture={() => {
          pausedRef.current = false
        }}
      >
        <div
          ref={viewportRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            pauseTemporarily()
            const viewport = e.currentTarget
            const children = Array.from(viewport.children) as HTMLElement[]
            const viewportLeft = viewport.getBoundingClientRect().left
            let bestIndex = 0
            let bestDistance = Number.POSITIVE_INFINITY
            for (let i = 0; i < children.length; i++) {
              const left = children[i].getBoundingClientRect().left
              const distance = Math.abs(left - viewportLeft)
              if (distance < bestDistance) {
                bestDistance = distance
                bestIndex = i
              }
            }
            setIndex(bestIndex)
          }}
        >
          {items.map((photo) => (
            <div key={photo.src} className="w-full shrink-0 snap-start sm:w-[85%] lg:w-[72%]">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-black/20 to-black/40">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 85vw, 72vw"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Foto anterior"
          disabled={!canPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-2 text-white/90 shadow-lg backdrop-blur transition hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:opacity-40"
          onClick={() => {
            pauseTemporarily()
            scrollToIndex(Math.max(0, index - 1))
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Próxima foto"
          disabled={!canNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-2 text-white/90 shadow-lg backdrop-blur transition hover:bg-black/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:opacity-40"
          onClick={() => {
            pauseTemporarily()
            scrollToIndex(Math.min(items.length - 1, index + 1))
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {items.map((photo, dotIndex) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Ir para foto ${dotIndex + 1}`}
            className={
              dotIndex === index
                ? "h-2.5 w-2.5 rounded-full border border-white/15 bg-white/35 transition focus:outline-none focus:ring-2 focus:ring-white/20"
                : "h-2.5 w-2.5 rounded-full border border-white/15 bg-white/10 transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/20"
            }
            onClick={() => {
              pauseTemporarily()
              scrollToIndex(dotIndex)
            }}
          />
        ))}
      </div>
    </div>
  )
}

