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
          <div className="absolute inset-0 bg-[url('/hero-gamer.jpg')] bg-cover bg-center opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/65 to-black" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              {ref ? (
                <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-200">
                  Indicação ativa: {ref}
                </p>
              ) : null}
              <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-200">
                Locação profissional para festas, eventos e ações promocionais
              </p>
              <h1 className="font-[var(--font-gamer)] text-4xl tracking-tight md:text-5xl">
                <span className="bg-gradient-to-r from-brand-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                  Estrutura gamer completa
                </span>{" "}
                com orçamento automático e reserva online
              </h1>
              <p className="text-zinc-300">
                Selecione os equipamentos, informe data, duração e local do
                evento. O sistema calcula deslocamento, descontos e apresenta as
                opções de pagamento.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href={`/orcamento${refQuery}`}>Fazer orçamento</Link>
                </Button>
                <Button asChild intent="secondary" size="lg">
                  <Link href="/equipamentos">Ver equipamentos</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm text-zinc-400">Destaque</p>
                <p className="mt-2 font-[var(--font-gamer)] text-lg">
                  Consoles + TVs 4K
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  Setup pronto para jogar em poucos minutos.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">Destaque</p>
                <p className="mt-2 font-[var(--font-gamer)] text-lg">PCs Gamer</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Periféricos e monitores inclusos no combo.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">Serviço</p>
                <p className="mt-2 font-[var(--font-gamer)] text-lg">Equipe no local</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Montagem, suporte e desmontagem.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">Condições</p>
                <p className="mt-2 font-[var(--font-gamer)] text-lg">Pix com desconto</p>
                <p className="mt-1 text-sm text-zinc-300">
                  E opção de sinal + restante na semana do evento.
                </p>
              </Card>
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
