import Link from "next/link"
import Image from "next/image"
import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/Button"
import { signOut } from "@/app/(auth)/actions"

function SiteLogo(props: { containerClassName: string; sizes: string }) {
  return (
    <Link href="/" className="flex items-center">
      <div className={props.containerClassName}>
        <Image
          src="/vrgh.png"
          alt="VRInfinity"
          fill
          sizes={props.sizes}
          className="object-contain"
          priority
        />
      </div>
    </Link>
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
      <div className="mx-auto max-w-6xl px-4 py-4">
        {user ? (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:hidden">
            <SiteLogo
              containerClassName="relative h-14 w-60 sm:h-16 sm:w-72"
              sizes="(max-width: 640px) 240px, 288px"
            />
            <Button
              asChild
              intent="secondary"
              className="h-9 justify-self-center px-4 text-sm ring-1 ring-white/15"
            >
              <Link href={isAdmin ? "/admin" : "/cliente"}>
                {isAdmin ? "Área do admin" : "Área do cliente"}
              </Link>
            </Button>
            <form action={signOut} className="justify-self-end">
              <Button type="submit" intent="ghost" className="h-9 px-3 text-sm ring-1 ring-white/15">
                Sair
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 md:hidden">
            <SiteLogo
              containerClassName="relative h-14 w-60 sm:h-16 sm:w-72"
              sizes="(max-width: 640px) 240px, 288px"
            />
            <div>
              <Button
                asChild
                intent="primary"
                className="h-9 px-4 text-sm shadow-lg shadow-brand-500/25 ring-1 ring-brand-300/40"
              >
                <Link href={loginHref}>Entrar</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="hidden items-center justify-between gap-4 md:flex">
          <SiteLogo
            containerClassName="relative h-24 w-[480px] max-w-full"
            sizes="480px"
          />

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
      </div>
    </header>
  )
}
