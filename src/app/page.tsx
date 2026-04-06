import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

export default function HomePage({
  searchParams
}: {
  searchParams?: { ref?: string }
}) {
  const ref = searchParams?.ref
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[url('/hero-gamer.jpg')] bg-cover bg-center opacity-60 md:opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/45 to-black/80 md:from-black/55 md:via-black/55 md:to-black/85" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-10 shadow-2xl shadow-black/50 backdrop-blur sm:px-10 md:bg-black/30">
            <div className="flex flex-wrap justify-center gap-2">
              {ref ? (
                <p className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                  Indicação ativa: {ref}
                </p>
              ) : null}
              <p className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                Locação profissional para festas, eventos e ações promocionais
              </p>
            </div>
            <h1 className="mt-6 font-[var(--font-gamer)] text-5xl leading-tight tracking-tight text-white drop-shadow-[0_2px_28px_rgba(0,0,0,0.9)] md:text-6xl">
              <span className="bg-gradient-to-r from-white via-brand-100 to-fuchsia-100 bg-clip-text text-transparent">
                Estrutura gamer completa
              </span>
            </h1>
            <p className="mt-3 font-[var(--font-gamer)] text-xl text-white/90 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] md:text-2xl">
              Orçamento automático e reserva online
            </p>
            <p className="mt-5 text-base text-white/80 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] md:text-lg">
              Selecione os equipamentos, informe data, duração e local do evento.
              O sistema calcula deslocamento, descontos e apresenta as opções de
              pagamento.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="shadow-xl shadow-brand-500/30 ring-1 ring-brand-300/40"
              >
                <Link href={`/orcamento${refQuery}`}>Fazer orçamento</Link>
              </Button>
              <Button
                asChild
                intent="secondary"
                size="lg"
                className="bg-white/10 ring-1 ring-white/15 hover:bg-white/15"
              >
                <Link href="/equipamentos">Ver equipamentos</Link>
              </Button>
            </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Como funciona
              </h2>
              <p className="text-zinc-300">
                Um fluxo simples do orçamento até a reserva.
              </p>
              <div className="pt-4">
                <Button asChild intent="ghost">
                  <Link href="/como-funciona">Ver detalhes</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:col-span-2 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-zinc-400">1</p>
                <p className="mt-2 font-semibold">Escolha os itens</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Selecione equipamentos e quantidade.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">2</p>
                <p className="mt-2 font-semibold">Informe data e local</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Duração e deslocamento entram no cálculo.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">3</p>
                <p className="mt-2 font-semibold">Envie a solicitação</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Reserva para análise e confirmação.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
