import Link from "next/link"
import { LoginForm } from "./LoginForm"

export default function LoginPage({
  searchParams
}: {
  searchParams?: { next?: string }
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Crie sua conta em segundos ou faça login para gerar seu orçamento.
      </h1>
      <p className="mt-2 text-zinc-300">
        É rápido e fácil — e você ainda acompanha reservas, cashback e indicações na
        sua área do cliente.
      </p>
      <LoginForm next={searchParams?.next} />
      <p className="mt-6 text-sm text-zinc-400">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-brand-300 hover:text-brand-200">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
