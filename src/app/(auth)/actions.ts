"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState = {
  error?: string
  message?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function getOrigin(): string | null {
  const origin = headers().get("origin")
  if (origin) return origin

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) return siteUrl

  return null
}

function mapAuthError(rawMessage: string) {
  const message = rawMessage.toLowerCase()
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "Este e-mail já está cadastrado. Tente entrar pelo login."
  }
  if (message.includes("password") && message.includes("6")) {
    return "A senha precisa ter pelo menos 6 caracteres."
  }
  if (message.includes("email") && message.includes("invalid")) {
    return "Digite um e-mail válido."
  }
  if (message.includes("signup") && message.includes("disabled")) {
    return "Cadastros estão desativados no momento."
  }
  if (message.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
  }
  return "Não foi possível criar sua conta. Tente novamente."
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
    const message = error.message.toLowerCase()
    if (message.includes("email") && message.includes("not confirmed")) {
      return { error: "Confirme seu e-mail antes de entrar." }
    }
    return { error: "E-mail ou senha inválidos." }
  }

  if (next && next !== "/cliente") {
    redirect(next)
  }

  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    redirect("/cliente")
  }

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role === "admin") {
    redirect("/admin")
  }

  redirect("/cliente")
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email")
  const password = getString(formData, "password")
  const ref = getString(formData, "ref")

  if (!email) return { error: "Digite um e-mail." }
  if (!password) return { error: "Digite uma senha." }

  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: ref ? { ref } : undefined
      }
    })

    if (error) {
      return { error: mapAuthError(error.message) }
    }

    if (data.session) {
      redirect("/cliente")
    }

    const signInRes = await supabase.auth.signInWithPassword({ email, password })
    if (signInRes.error) {
      const msg = signInRes.error.message.toLowerCase()
      if (msg.includes("email") && msg.includes("not confirmed")) {
        const origin = getOrigin()
        return {
          error:
            "Seu Supabase está exigindo confirmação de e-mail. Para cadastrar sem e-mail, desative Auth → Providers → Email → Confirm email. Depois tente novamente."
        }
      }
      return { error: "Conta criada, mas não foi possível entrar. Tente fazer login." }
    }

    redirect("/cliente")
  } catch (e) {
    const message = e instanceof Error ? e.message : ""
    if (message.includes("Missing environment variable")) {
      return {
        error:
          "Configuração do Supabase ausente na Vercel. Verifique as variáveis de ambiente do projeto."
      }
    }
    return { error: "Não foi possível criar sua conta. Tente novamente." }
  }
}

export async function signOut() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
