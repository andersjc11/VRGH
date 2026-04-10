import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

export const dynamic = "force-dynamic"

type EquipmentRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: { ref?: string }
}) {
  const ref = searchParams?.ref
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const equipamentosHref = ref ? `/?ref=${encodeURIComponent(ref)}#equipamentos` : "/#equipamentos"
  const comoFuncionaHref = ref ? `/?ref=${encodeURIComponent(ref)}#como-funciona` : "/#como-funciona"
  const whatsappHref = `https://wa.me/5512991568840?text=${encodeURIComponent(
    "Olá! Quero um orçamento para locação de estrutura gamer."
  )}`

  const supabase = createSupabaseServerClient()
  const equipmentsRes = await supabase
    .from("equipments")
    .select("id,name,description,category,image_url")
    .eq("active", true)
    .order("created_at", { ascending: true })
  const equipments = (equipmentsRes.data ?? []) as EquipmentRow[]

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[url('/hero-gamer.jpg')] bg-cover bg-center opacity-60 md:opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-black/75 md:from-black/55 md:via-black/55 md:to-black/85" />
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
                <Link href={equipamentosHref}>Ver equipamentos</Link>
              </Button>
            </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Transforme seu evento em uma experiência gamer inesquecível
              </h2>
              <p className="text-zinc-300">
                Levamos uma estrutura gamer completa até o local do seu evento:
                casa, salão, escola, empresa ou espaço corporativo. Você não se
                preocupa com nada: equipamentos, montagem, operação e suporte
                durante todo o evento.
              </p>
              <div className="pt-2">
                <Button asChild intent="secondary">
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm text-zinc-400">O que está incluso</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  <li>Montagem e desmontagem</li>
                  <li>Operação e suporte durante o evento</li>
                  <li>Cabos, extensões e organização do setup</li>
                  <li>Higienização e checklist de funcionamento</li>
                </ul>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">Ideal para</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  <li>Festas infantis e aniversários</li>
                  <li>Confraternizações e eventos corporativos</li>
                  <li>Escolas e eventos educacionais</li>
                  <li>Ativações de marca e feiras</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-white/10 scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Do primeiro contato ao evento: simples, rápido e seguro
              </h2>
              <p className="text-zinc-300">
                Um fluxo prático para você contratar com clareza e previsibilidade.
              </p>
              <div className="pt-4">
                <Button asChild intent="ghost">
                  <Link href={comoFuncionaHref}>Ver detalhes</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
              <Card>
                <p className="text-sm text-zinc-400">1</p>
                <p className="mt-2 font-semibold">Monte seu orçamento</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Selecione equipamentos, data, duração e local do evento.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">2</p>
                <p className="mt-2 font-semibold">Envie sua reserva</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Você já vê a disponibilidade da data e envia a reserva.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">3</p>
                <p className="mt-2 font-semibold">Montagem e operação</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Equipe no local para montar e operar durante o evento.
                </p>
              </Card>
              <Card>
                <p className="text-sm text-zinc-400">4</p>
                <p className="mt-2 font-semibold">Suporte e encerramento</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Suporte durante toda a experiência e desmontagem ao final.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Seu evento com os melhores equipamentos
              </h2>
              <p className="text-zinc-300">
                Combine consoles, PCs, simuladores e realidade virtual de acordo
                com o seu público.
              </p>
              <div className="pt-4">
                <Button asChild intent="ghost">
                  <Link href={equipamentosHref}>Ver catálogo</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
              <Card>
                <p className="mt-2 font-semibold">Consoles</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Para todas as idades e estilos de jogos.
                </p>
              </Card>
              <Card>
                <p className="mt-2 font-semibold">Realidade virtual</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Experiência imersiva com óculos VR.
                </p>
              </Card>
              <Card>
                <p className="mt-2 font-semibold">PC gamer completo</p>
                <p className="mt-1 text-sm text-zinc-300">
                  CPU + monitor + periféricos para jogar e competir.
                </p>
              </Card>
              <Card>
                <p className="mt-2 font-semibold">Simuladores</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Cockpit de corrida e setups premium para ativações.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="equipamentos" className="border-b border-white/10 scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Equipamentos</h2>
            <p className="text-zinc-300">
              Escolha os itens que mais combinam com seu evento e monte o seu orçamento.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {equipments.length === 0 ? (
              <>
                <Card>
                  <p className="text-sm text-zinc-400">Exemplo</p>
                  <p className="mt-2 font-semibold">Console + TV 55&quot;</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Ideal para festas e eventos corporativos.
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-zinc-400">Exemplo</p>
                  <p className="mt-2 font-semibold">PC Gamer + Monitor</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Setup completo com periféricos.
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-zinc-400">Exemplo</p>
                  <p className="mt-2 font-semibold">Simulador</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Experiência premium para ativações.
                  </p>
                </Card>
              </>
            ) : (
              equipments.map((eq) => (
                <Card key={eq.id}>
                  <p className="text-sm text-zinc-400">{eq.category ?? "Equipamento"}</p>
                  <p className="mt-2 font-semibold">{eq.name}</p>
                  {eq.image_url ? (
                    <img
                      src={eq.image_url}
                      alt={eq.name}
                      className="mt-3 h-44 w-full rounded-lg border border-white/10 bg-white/5 object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-300">{eq.description ?? "—"}</p>
                </Card>
              ))
            )}
          </div>

          <div className="mt-10">
            <Button asChild size="lg" className="shadow-xl shadow-brand-500/30 ring-1 ring-brand-300/40">
              <Link href={`/orcamento${refQuery}`}>Fazer orçamento</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-brand-600/20 via-fuchsia-600/10 to-white/5 p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Pronto para levar a experiência gamer para o seu evento?
                </h2>
                <p className="text-zinc-300">
                  Faça um orçamento automático ou chame no WhatsApp para tirar
                  dúvidas e receber uma proposta personalizada.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button asChild size="lg" className="shadow-xl shadow-brand-500/30 ring-1 ring-brand-300/40">
                  <Link href={`/orcamento${refQuery}`}>Fazer orçamento</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  intent="secondary"
                  className="bg-white/10 ring-1 ring-white/15 hover:bg-white/15"
                >
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    Chamar no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
