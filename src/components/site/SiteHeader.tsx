import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/Button"
import { signOut } from "@/app/(auth)/actions"

export async function SiteHeader() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const profileRes = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : null
  const isAdmin = profileRes?.data?.role === "admin"

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600" />
          <span className="font-semibold tracking-tight">VRGH</span>
        </Link>

        {!isAdmin ? (
          <nav className="hidden items-center gap-2 md:flex">
            <Button asChild intent="ghost">
              <Link href="/equipamentos">Equipamentos</Link>
            </Button>
            <Button asChild intent="ghost">
              <Link href="/como-funciona">Como funciona</Link>
            </Button>
            <Button asChild intent="ghost">
              <Link href="/cobertura">Cobertura</Link>
            </Button>
            <Button asChild intent="ghost">
              <Link href="/orcamento">Orçamento</Link>
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
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
