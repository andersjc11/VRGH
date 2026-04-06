import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const ref = request.nextUrl.searchParams.get("ref")
  if (ref) {
    response.cookies.set({
      name: "vrgh_ref",
      value: ref,
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    })
  }

  const supabase = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, any>) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: Record<string, any>) {
          response.cookies.set({ name, value: "", ...options })
        }
      }
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
