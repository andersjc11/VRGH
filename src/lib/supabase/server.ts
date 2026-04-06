import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { requireEnv } from "@/lib/env"

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, any>) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name: string, options: Record<string, any>) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch {}
        }
      }
    }
  )
}

