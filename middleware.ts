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
  const pathname = request.nextUrl.pathname
  if (pathname === "/equipamentos" || pathname.startsWith("/equipamentos/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.hash = "equipamentos"
    const response = NextResponse.redirect(url, 308)
    const ref = request.nextUrl.searchParams.get("ref")
    if (ref) {
      response.cookies.set({
        name: "vrgh_ref",
        value: ref,
        path: "/",
        maxAge: 60 * 60 * 24 * 30
      })
    }
    return response
  }
  if (pathname === "/cobertura" || pathname.startsWith("/cobertura/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    const response = NextResponse.redirect(url, 308)
    const ref = request.nextUrl.searchParams.get("ref")
    if (ref) {
      response.cookies.set({
        name: "vrgh_ref",
        value: ref,
        path: "/",
        maxAge: 60 * 60 * 24 * 30
      })
    }
    return response
  }
  if (pathname === "/como-funciona" || pathname.startsWith("/como-funciona/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.hash = "como-funciona"
    const response = NextResponse.redirect(url, 308)
    const ref = request.nextUrl.searchParams.get("ref")
    if (ref) {
      response.cookies.set({
        name: "vrgh_ref",
        value: ref,
        path: "/",
        maxAge: 60 * 60 * 24 * 30
      })
    }
    return response
  }

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
