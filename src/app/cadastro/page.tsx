import Link from "next/link"
import { cookies, headers } from "next/headers"
import { CadastroForm } from "./CadastroForm"

export default function CadastroPage({
  searchParams
}: {
  searchParams?: { ref?: string }
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
  const refCode = refFromQuery || cookieRef || refFromReferer
  const refQuery = refCode ? `?ref=${encodeURIComponent(refCode)}` : ""

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-2 text-zinc-300">
        Crie sua conta para enviar reservas, acompanhar status e receber cashback.
      </p>
      <CadastroForm refCode={refCode} />
      <p className="mt-6 text-sm text-zinc-400">
        Já tem conta?{" "}
        <Link href={`/login${refQuery}`} className="text-brand-300 hover:text-brand-200">
          Entrar
        </Link>
      </p>
    </div>
  )
}
