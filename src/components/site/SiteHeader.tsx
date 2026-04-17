import Link from "next/link"
import Image from "next/image"
import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/Button"
import { signOut } from "@/app/(auth)/actions"

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
        <Link href="/" className="flex items-center">
          <div className="relative h-32 w-[640px] max-w-full">
            <Image
              src="/vrgh.png"
              alt="VRInfinity"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
              priority
            />
          </div>
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
