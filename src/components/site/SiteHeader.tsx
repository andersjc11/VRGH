import Link from "next/link"
import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/Button"
import { signOut } from "@/app/(auth)/actions"

function BrandLogo() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-8 w-8"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="vrinfinity_logo_g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#d946ef" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M20 20v-8h24v8"
        fill="none"
        stroke="url(#vrinfinity_logo_g)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 32c0-8 6-14 14-14h16c8 0 14 6 14 14s-6 14-14 14H24c-8 0-14-6-14-14Z"
        fill="none"
        stroke="url(#vrinfinity_logo_g)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M22 28l10 8m10-8L32 36m-10 8h20"
        fill="none"
        stroke="#22d3ee"
        strokeOpacity="0.9"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export async function SiteHeader() {
  const ref = cookies().get("vrgh_ref")?.value?.trim()
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const orcamentoHref = ref ? `/orcamento${refQuery}` : "/orcamento"
  const loginHref = ref ? `/login${refQuery}` : "/login"
  const cadastroHref = ref ? `/cadastro${refQuery}` : "/cadastro"
  const equipamentosHref = ref ? `/?ref=${encodeURIComponent(ref)}#equipamentos` : "/#equipamentos"
  const comoFuncionaHref = ref ? `/?ref=${encodeURIComponent(ref)}#como-funciona` : "/#como-funciona"

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const profileRes = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : null
  const isAdmin = profileRes?.data?.role === "admin"

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo />
          <span className="bg-gradient-to-r from-white via-brand-100 to-fuchsia-100 bg-clip-text font-semibold tracking-tight text-transparent">
            VRINFINITY
          </span>
        </Link>

        {!isAdmin ? (
          <nav className="hidden items-center gap-2 md:flex">
            <Button asChild intent="ghost">
              <Link href={equipamentosHref}>Equipamentos</Link>
            </Button>
            <Button asChild intent="ghost">
              <Link href={comoFuncionaHref}>Como funciona</Link>
            </Button>
            <Button asChild intent="ghost">
              <Link href={orcamentoHref}>Orçamento</Link>
            </Button>
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild intent="secondary">
                <Link href={isAdmin ? "/admin" : "/cliente"}>
                  {isAdmin ? "Área do admin" : "Área do cliente"}
                </Link>
              </Button>
              <form action={signOut}>
                <Button type="submit" intent="ghost">
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild intent="ghost">
                <Link href={loginHref}>Entrar</Link>
              </Button>
              <Button asChild>
                <Link href={cadastroHref}>Criar conta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
