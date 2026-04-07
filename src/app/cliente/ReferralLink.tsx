"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export function ReferralLink({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setStatus("copied")
      window.setTimeout(() => setStatus("idle"), 1500)
    } catch {
      try {
        const el = document.createElement("textarea")
        el.value = url
        el.style.position = "fixed"
        el.style.left = "-9999px"
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
        setStatus("copied")
        window.setTimeout(() => setStatus("idle"), 1500)
      } catch {
        setStatus("error")
        window.setTimeout(() => setStatus("idle"), 2000)
      }
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={url} readOnly />
        <Button type="button" intent="secondary" onClick={copy} disabled={!url}>
          {status === "copied" ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      {status === "error" ? (
        <p className="text-xs text-red-300">Não foi possível copiar. Copie manualmente.</p>
      ) : null}
    </div>
  )
}

