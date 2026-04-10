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

type IconProps = { className?: string }

function IconSparkles({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 2l1.2 4.2L17.4 7.4l-4.2 1.2L12 12.8l-1.2-4.2L6.6 7.4l4.2-1.2L12 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M19 12l.8 2.8 2.8.8-2.8.8L19 20l-.8-2.8-2.8-.8 2.8-.8L19 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 13l.7 2.3 2.3.7-2.3.7L5 19l-.7-2.3L2 16l2.3-.7L5 13z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGamepad({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8.4 10.2H15.6c1.4 0 2.6 1 2.9 2.4l.8 3.4a2.8 2.8 0 0 1-5.2 1.9l-.6-1.1a1.8 1.8 0 0 0-3.1 0l-.6 1.1a2.8 2.8 0 0 1-5.2-1.9l.8-3.4c.3-1.4 1.5-2.4 3-2.4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7.8 13.4h3.2M9.4 11.8v3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15.2 13.1h.01M17 14.9h.01"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCalendarCheck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 3v3M17 3v3M4.5 7.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 5.5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 14.2l1.6 1.6 3.9-3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTag({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 13l-7 7-9-9V4h7l9 9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.5h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCheck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconHeadset({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 12a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5.5 12.5h1.6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.5a1.5 1.5 0 0 1-1.5-1.5v-4.5a1.5 1.5 0 0 1 1.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18.9 12.5h-1.6a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h1.6a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMonitor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 20h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconVr({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6.5 10h11a3 3 0 0 1 0 6h-11a3 3 0 0 1 0-6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 13h.01M15.6 13h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M9.8 16.2l-1.6 2.3M14.2 16.2l1.6 2.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconWheel({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 4v4M12 16v4M4 12h4M16 12h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: { ref?: string }
}) {
  const ref = searchParams?.ref
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const equipamentosHref = ref ? `/?ref=${encodeURIComponent(ref)}#equipamentos` : "/#equipamentos"
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
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(217,70,239,0.10),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px]"
      />
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[url('/hero-gamer.jpg')] bg-cover bg-center opacity-60 md:opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-black/75 md:from-black/55 md:via-black/55 md:to-black/85" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-3xl border border-white/10 bg-black/25 px-6 py-10 shadow-2xl shadow-black/50 backdrop-blur sm:px-10 md:bg-black/35">
              <div className="flex flex-wrap justify-center gap-2">
                {ref ? (
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.55)]" />
                    Indicação ativa: {ref}
                  </p>
                ) : null}
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                  <IconSparkles className="h-4 w-4 text-fuchsia-200" />
                  Festa + Gamer no seu evento
                </p>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                  <IconCalendarCheck className="h-4 w-4 text-brand-200" />
                  Disponibilidade na hora
                </p>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                  <IconTag className="h-4 w-4 text-amber-200" />
                  Desconto por pacotes
                </p>
              </div>

              <h1 className="mt-7 font-[var(--font-gamer)] text-5xl leading-tight tracking-tight text-white drop-shadow-[0_2px_28px_rgba(0,0,0,0.9)] md:text-6xl">
                <span className="bg-gradient-to-r from-white via-brand-100 to-fuchsia-100 bg-clip-text text-transparent">
                  Estrutura gamer completa
                </span>
              </h1>
              <p className="mt-3 font-[var(--font-gamer)] text-xl text-white/90 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] md:text-2xl">
                Orçamento automático, valor na hora e reserva online
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
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <p className="text-xs text-white/70">Experiência</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                    <IconGamepad className="h-4 w-4 text-cyan-200" />
                    Setup gamer premium
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <p className="text-xs text-white/70">Operação</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                    <IconHeadset className="h-4 w-4 text-brand-200" />
                    Suporte no evento
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <p className="text-xs text-white/70">Facilidade</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                    <IconCalendarCheck className="h-4 w-4 text-emerald-200" />
                    Reserva online
                  </p>
                </div>
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
              <Card className="relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%)]"
                />
                <div className="relative">
                  <p className="text-sm text-zinc-200">O que está incluso</p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Montagem e desmontagem</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Operação e suporte durante o evento</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Cabos, extensões e organização do setup</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Higienização e checklist de funcionamento</span>
                    </li>
                  </ul>
                </div>
              </Card>
              <Card className="relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.16),transparent_55%)]"
                />
                <div className="relative">
                  <p className="text-sm text-zinc-200">Ideal para</p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    <li className="flex gap-2">
                      <IconSparkles className="mt-0.5 h-4 w-4 text-fuchsia-200" />
                      <span>Festas infantis e aniversários</span>
                    </li>
                    <li className="flex gap-2">
                      <IconSparkles className="mt-0.5 h-4 w-4 text-fuchsia-200" />
                      <span>Confraternizações e eventos corporativos</span>
                    </li>
                    <li className="flex gap-2">
                      <IconSparkles className="mt-0.5 h-4 w-4 text-fuchsia-200" />
                      <span>Escolas e eventos educacionais</span>
                    </li>
                    <li className="flex gap-2">
                      <IconSparkles className="mt-0.5 h-4 w-4 text-fuchsia-200" />
                      <span>Ativações de marca e feiras</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-white/10 scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                <IconSparkles className="h-4 w-4 text-fuchsia-200" />
                Como funciona
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Do primeiro contato ao evento: simples, rápido e seguro
              </h2>
              <p className="text-zinc-300">
                Um fluxo prático para você contratar com clareza e previsibilidade.
              </p>
              <div className="pt-4">
                <Button asChild intent="secondary">
                  <Link href={`/orcamento${refQuery}`}>Começar orçamento</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-brand-600/30 via-white/5 to-transparent">
                      <IconMonitor className="h-5 w-5 text-brand-200" />
                    </span>
                    <div>
                      <p className="text-xs text-zinc-400">Passo 1</p>
                      <p className="font-semibold">Monte seu orçamento</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Selecione equipamentos, data, duração e local do evento.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.18),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 via-white/5 to-transparent">
                      <IconCalendarCheck className="h-5 w-5 text-fuchsia-200" />
                    </span>
                    <div>
                      <p className="text-xs text-zinc-400">Passo 2</p>
                      <p className="font-semibold">Envie sua reserva</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Você já vê disponibilidade e valor da locação (com desconto para pacotes) e envia a reserva.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/20 via-white/5 to-transparent">
                      <IconGamepad className="h-5 w-5 text-cyan-200" />
                    </span>
                    <div>
                      <p className="text-xs text-zinc-400">Passo 3</p>
                      <p className="font-semibold">Montagem e operação</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Equipe no local para montar e operar durante o evento.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600/20 via-white/5 to-transparent">
                      <IconHeadset className="h-5 w-5 text-emerald-200" />
                    </span>
                    <div>
                      <p className="text-xs text-zinc-400">Passo 4</p>
                      <p className="font-semibold">Suporte e encerramento</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Suporte durante toda a experiência e desmontagem ao final.
                  </p>
                </div>
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
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/20 via-white/5 to-transparent">
                      <IconGamepad className="h-5 w-5 text-cyan-200" />
                    </span>
                    <p className="font-semibold">Consoles</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Para todas as idades e estilos de jogos.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.18),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 via-white/5 to-transparent">
                      <IconVr className="h-5 w-5 text-fuchsia-200" />
                    </span>
                    <p className="font-semibold">Realidade virtual</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Experiência imersiva com óculos VR.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-brand-600/30 via-white/5 to-transparent">
                      <IconMonitor className="h-5 w-5 text-brand-200" />
                    </span>
                    <p className="font-semibold">PC gamer completo</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Ryzen 5 5600X, RTX 3060 12GB, 16GB RAM, NVMe 500GB + monitor 144Hz.
                  </p>
                </div>
              </Card>
              <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_55%)] opacity-80" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-amber-600/20 via-white/5 to-transparent">
                      <IconWheel className="h-5 w-5 text-amber-200" />
                    </span>
                    <p className="font-semibold">Simuladores</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Cockpit de corrida, simulador de montanha russa e setups premium para ativações.
                  </p>
                </div>
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
                <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_55%)] opacity-80" />
                  <div className="relative">
                    <p className="text-sm text-zinc-400">Exemplo</p>
                    <p className="mt-2 font-semibold">Console + TV 55&quot;</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Ideal para festas e eventos corporativos.
                    </p>
                  </div>
                </Card>
                <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_55%)] opacity-80" />
                  <div className="relative">
                    <p className="text-sm text-zinc-400">Exemplo</p>
                    <p className="mt-2 font-semibold">PC Gamer + Monitor</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Ryzen 5 5600X, RTX 3060 12GB, 16GB RAM, NVMe 500GB + monitor 144Hz.
                    </p>
                  </div>
                </Card>
                <Card className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_55%)] opacity-80" />
                  <div className="relative">
                    <p className="text-sm text-zinc-400">Exemplo</p>
                    <p className="mt-2 font-semibold">Simulador</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Experiência premium para ativações.
                    </p>
                  </div>
                </Card>
              </>
            ) : (
              equipments.map((eq) => (
                <Card
                  key={eq.id}
                  className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_55%)] opacity-80" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-200">
                        {eq.category ?? "Equipamento"}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-semibold">{eq.name}</p>
                    {eq.image_url ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        <img
                          src={eq.image_url}
                          alt={eq.name}
                          className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-300">{eq.description ?? "—"}</p>
                  </div>
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
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-brand-600/20 via-fuchsia-600/10 to-white/5 p-8 md:p-10">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_55%)]" />
            <div aria-hidden="true" className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="relative space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-200">
                  <IconSparkles className="h-4 w-4 text-fuchsia-200" />
                  Últimas vagas do mês
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Pronto para levar a experiência gamer para o seu evento?
                </h2>
                <p className="text-zinc-300">
                  Faça um orçamento automático ou chame no WhatsApp para tirar
                  dúvidas e receber uma proposta personalizada.
                </p>
                <div className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-300" />
                    Valor na hora com descontos
                  </p>
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-300" />
                    Reserva online em poucos cliques
                  </p>
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-300" />
                    Montagem + operação no evento
                  </p>
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-300" />
                    Atendimento rápido no WhatsApp
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-3 sm:flex-row sm:justify-end">
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
