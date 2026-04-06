"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState = {
  error?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email")
  const password = getString(formData, "password")
  const next = getString(formData, "next") || "/cliente"

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "E-mail ou senha inválidos." }
  }

  redirect(next)
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email")
  const password = getString(formData, "password")
  const ref = getString(formData, "ref")

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: ref ? { ref } : undefined
    }
  })

  if (error) {
    return { error: "Não foi possível criar sua conta. Tente novamente." }
  }

  redirect("/login")
}

export async function signOut() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
