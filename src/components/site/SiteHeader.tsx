import Link from "next/link"
import Image from "next/image"
import { cookies, headers } from "next/headers"
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

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export async function SiteHeader() {
  const pathname = headers().get("x-vrgh-pathname") ?? ""
  const isLandingPage = pathname === "/simulador-futebol-virtual"
  const ref = cookies().get("vrgh_ref")?.value?.trim()
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const orcamentoHref = isLandingPage ? "#orcamento" : ref ? `/orcamento${refQuery}` : "/orcamento"
  const loginHref = ref ? `/login${refQuery}` : "/login"
  const cadastroHref = ref ? `/cadastro${refQuery}` : "/cadastro"
  const equipamentosHref = isLandingPage
    ? "#o-que-levamos"
    : ref
      ? `/?ref=${encodeURIComponent(ref)}#equipamentos`
      : "/#equipamentos"
  const comoFuncionaHref = isLandingPage
    ? "#como-funciona"
    : ref
      ? `/?ref=${encodeURIComponent(ref)}#como-funciona`
      : "/#como-funciona"
  const eventosHref = "#eventos"
  const clientesHref = "#clientes"

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
          <div className="md:hidden">
            <div className="flex justify-center">
              <SiteLogo
                containerClassName="relative h-14 w-60 sm:h-16 sm:w-72"
                sizes="(max-width: 640px) 240px, 288px"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                asChild
                intent="primary"
                className="h-9 px-2 text-xs whitespace-nowrap shadow-lg shadow-brand-500/25 ring-1 ring-brand-300/40 sm:px-3 sm:text-sm"
              >
                <Link href={isAdmin ? "/admin" : "/cliente"}>
                  <span className="sm:hidden">{isAdmin ? "Área do Admin" : "Área do Cliente"}</span>
                  <span className="hidden sm:inline">{isAdmin ? "Área do admin" : "Área do cliente"}</span>
                </Link>
              </Button>
              <form action={signOut}>
                <Button
                  type="submit"
                  intent="ghost"
                  className="h-9 px-2 text-xs whitespace-nowrap ring-1 ring-white/15 sm:px-3 sm:text-sm"
                >
                  Sair
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="md:hidden">
            <div className="flex justify-center">
              <SiteLogo
                containerClassName="relative h-14 w-60 sm:h-16 sm:w-72"
                sizes="(max-width: 640px) 240px, 288px"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <details className="group relative">
                <summary
                  aria-label="Abrir menu"
                  className="flex h-9 w-9 list-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden"
                >
                  <IconMenu className="h-5 w-5" />
                </summary>

                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 hidden w-56 rounded-xl border border-white/10 bg-zinc-950/95 p-2 shadow-lg backdrop-blur group-open:block">
                  <div className="space-y-1">
                    <Link
                      href={equipamentosHref}
                      className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                    >
                      {isLandingPage ? "O que levamos" : "Equipamentos"}
                    </Link>
                    <Link
                      href={comoFuncionaHref}
                      className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                    >
                      Como funciona
                    </Link>
                    {isLandingPage ? (
                      <>
                        <Link
                          href={eventosHref}
                          className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                        >
                          Eventos
                        </Link>
                        <Link
                          href={clientesHref}
                          className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                        >
                          Clientes
                        </Link>
                      </>
                    ) : null}
                    <Link
                      href={orcamentoHref}
                      className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10"
                    >
                      Orçamento
                    </Link>
                  </div>
                </div>
              </details>

              {isLandingPage ? (
                <Button
                  asChild
                  intent="primary"
                  className="h-9 px-2 text-xs whitespace-nowrap shadow-lg shadow-brand-500/25 ring-1 ring-brand-300/40 sm:px-3 sm:text-sm"
                >
                  <Link href={orcamentoHref}>Pedir orçamento</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  intent="primary"
                  className="h-9 px-2 text-xs whitespace-nowrap shadow-lg shadow-brand-500/25 ring-1 ring-brand-300/40 sm:px-3 sm:text-sm"
                >
                  <Link href={loginHref}>Entrar</Link>
                </Button>
              )}
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
                <Link href={equipamentosHref}>{isLandingPage ? "O que levamos" : "Equipamentos"}</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href={comoFuncionaHref}>Como funciona</Link>
              </Button>
              {isLandingPage ? (
                <>
                  <Button asChild intent="ghost">
                    <Link href={eventosHref}>Eventos</Link>
                  </Button>
                  <Button asChild intent="ghost">
                    <Link href={clientesHref}>Clientes</Link>
                  </Button>
                </>
              ) : null}
              <Button asChild intent="ghost">
                <Link href={orcamentoHref}>{isLandingPage ? "Orçamento" : "Orçamento"}</Link>
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
                {isLandingPage ? (
                  <Button asChild className="shadow-lg shadow-brand-500/20 ring-1 ring-brand-300/35">
                    <Link href={orcamentoHref}>Pedir orçamento</Link>
                  </Button>
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
