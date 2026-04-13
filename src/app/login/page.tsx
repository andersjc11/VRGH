import Link from "next/link"
import { cookies, headers } from "next/headers"
import { LoginForm } from "./LoginForm"

export default function LoginPage({
  searchParams
}: {
  searchParams?: { next?: string; ref?: string }
}) {
  const cookieRef = cookies().get("vrgh_ref")?.value?.trim()
  const refFromQuery = typeof searchParams?.ref === "string" ? searchParams.ref.trim() : ""
  const referer = headers().get("referer")
  const refFromReferer = (() => {
    if (!referer) return ""
    try {
      const url = new URL(referer)
      return (url.searchParams.get("ref") ?? "").trim()
    } catch {
      return ""
    }
  })()
  const ref = refFromQuery || cookieRef || refFromReferer
  const next = typeof searchParams?.next === "string" ? searchParams.next.trim() : ""
  const cadastroParams = new URLSearchParams()
  if (ref) cadastroParams.set("ref", ref)
  if (next) cadastroParams.set("next", next)
  const cadastroQuery = cadastroParams.toString()
  const cadastroHref = cadastroQuery ? `/cadastro?${cadastroQuery}` : "/cadastro"
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Crie sua conta em segundos ou faça login para gerar seu orçamento.
      </h1>
      {ref ? (
        <p className="mt-2 text-sm text-zinc-300">Indicação ativa: {ref}</p>
      ) : null}
      <p className="mt-2 text-zinc-300">
        É rápido e fácil — e você ainda acompanha reservas, cashback e indicações na
        sua área do cliente.
      </p>
      <LoginForm next={searchParams?.next} refCode={ref || undefined} />
      <p className="mt-6 text-sm text-zinc-400">
        Não tem conta?{" "}
        <Link href={cadastroHref} className="text-brand-300 hover:text-brand-200">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
