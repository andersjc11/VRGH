"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

type IconProps = { className?: string }

function IconBall({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7.4l3.1 2.2-1.2 3.7H10.1L8.9 9.6 12 7.4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.9 9.6L6.5 8M15.1 9.6 17.5 8M10.1 13.3 9 16.8M13.9 13.3 15 16.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconGoal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 7h16v12H4V7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 7v12M16 7v12M4 11h16M4 15h16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.8"
      />
    </svg>
  )
}

function IconWhistle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M9.5 9.5h5.7a3.3 3.3 0 0 1 3.3 3.3v.5a4.2 4.2 0 0 1-4.2 4.2H9.8A4.8 4.8 0 0 1 5 12.9V12a2.5 2.5 0 0 1 2.5-2.5h2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9.5V7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M18.7 9.3l1.8-1.1M19.2 12.2l2-.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
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

type CarouselItem = {
  title: string
  subtitle?: string
  meta?: string
}

function Carousel(props: {
  id?: string
  title: string
  description: string
  items: CarouselItem[]
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)

  const scrollToIndex = (nextIndex: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const children = Array.from(viewport.children) as HTMLElement[]
    const target = children[nextIndex]
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })
    setIndex(nextIndex)
  }

  const canPrev = index > 0
  const canNext = index < props.items.length - 1

  return (
    <section id={props.id} className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{props.title}</h2>
            <p className="max-w-2xl text-sm text-zinc-300">{props.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              intent="secondary"
              aria-label="Anterior"
              disabled={!canPrev}
              onClick={() => scrollToIndex(Math.max(0, index - 1))}
            >
              ←
            </Button>
            <Button
              type="button"
              intent="secondary"
              aria-label="Próximo"
              disabled={!canNext}
              onClick={() => scrollToIndex(Math.min(props.items.length - 1, index + 1))}
            >
              →
            </Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch]"
          onScroll={(e) => {
            const viewport = e.currentTarget
            const children = Array.from(viewport.children) as HTMLElement[]
            const viewportLeft = viewport.getBoundingClientRect().left
            let bestIndex = 0
            let bestDistance = Number.POSITIVE_INFINITY
            for (let i = 0; i < children.length; i++) {
              const left = children[i].getBoundingClientRect().left
              const distance = Math.abs(left - viewportLeft)
              if (distance < bestDistance) {
                bestDistance = distance
                bestIndex = i
              }
            }
            setIndex(bestIndex)
          }}
        >
          {props.items.map((item) => (
            <Card
              key={`${item.title}-${item.meta ?? ""}`}
              className="w-[86%] shrink-0 snap-start sm:w-[420px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  {item.subtitle ? <p className="text-sm text-zinc-300">{item.subtitle}</p> : null}
                </div>
                <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5" />
              </div>
              {item.meta ? <p className="mt-4 text-xs text-zinc-400">{item.meta}</p> : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function SimuladorFutebolVirtualPage() {
  useEffect(() => {
    document.body.classList.add("vrgh-landing-simulador-futebol-virtual")
    return () => {
      document.body.classList.remove("vrgh-landing-simulador-futebol-virtual")
    }
  }, [])

  const whatsappHref = useMemo(() => {
    const text =
      "Olá! Quero um orçamento para o Simulador de Futebol Virtual (cobrança de pênaltis).\n\n" +
      "Data(s):\nLocal (cidade/UF):\nHorário:\nPrecisa de cenografia (lona/piso/prismas)?\nEmissão de NF:\n"
    return `https://wa.me/5512991568840?text=${encodeURIComponent(text)}`
  }, [])

  const events = useMemo<CarouselItem[]>(
    () => [
      {
        title: "Uniube Aberta",
        subtitle: "Uberaba/MG • Ativação de cobrança de pênaltis em realidade virtual",
        meta: "Montagem 22/05 • Evento 23/05 (09h–15h) • Desmontagem a partir das 16h"
      },
      {
        title: "Shopping Cidade Jardim",
        subtitle: "São Paulo/SP • Ativação dentro da Academia Reebok",
        meta: "Arena indoor • Fluxo contínuo • Operação com promotor"
      },
      {
        title: "ABS",
        subtitle: "Uberaba/MG • Ativação corporativa",
        meta: "Edição anterior com alto engajamento e fila organizada"
      },
      {
        title: "Arena de Verão",
        subtitle: "Balneário Camboriú/SC • Temporada com múltiplas datas",
        meta: "Calendário: junho e julho • Planejamento de escala e equipe"
      }
    ],
    []
  )

  const companies = useMemo<CarouselItem[]>(
    () => [
      { title: "UNIUBE", subtitle: "Universidade", meta: "Ação em evento aberto ao público" },
      { title: "Reebok (Academia)", subtitle: "Fitness & experiência", meta: "Ativação em shopping" },
      { title: "Shopping Cidade Jardim", subtitle: "Varejo premium", meta: "Evento indoor" },
      { title: "ABS", subtitle: "Indústria/serviços", meta: "Ativação corporativa" }
    ],
    []
  )

  return (
    <div className="relative">
      <style jsx global>{`
        body.vrgh-landing-simulador-futebol-virtual > div > header {
          display: none;
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 text-white backdrop-blur print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-36">
                <Image src="/vrgh.png" alt="VRGH" fill sizes="144px" className="object-contain" />
              </div>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Button asChild intent="ghost">
                <Link href="#o-que-levamos">O que levamos</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href="#como-funciona">Como funciona</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href="#eventos">Eventos</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href="#clientes">Clientes</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href="#orcamento">Orçamento</Link>
              </Button>
            </nav>

            <Button
              asChild
              size="sm"
              className="shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/35"
            >
              <Link href="#orcamento">Pedir orçamento</Link>
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <a
              href="#o-que-levamos"
              className="shrink-0 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/90"
            >
              O que levamos
            </a>
            <a
              href="#como-funciona"
              className="shrink-0 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/90"
            >
              Como funciona
            </a>
            <a
              href="#eventos"
              className="shrink-0 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/90"
            >
              Eventos
            </a>
            <a
              href="#clientes"
              className="shrink-0 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/90"
            >
              Clientes
            </a>
            <a
              href="#orcamento"
              className="shrink-0 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/90"
            >
              Orçamento
            </a>
          </div>
        </div>
      </header>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(34,197,94,0.10),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px]"
      />

      <section className="relative overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/15 via-black/20 to-black/80" />
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-3xl border border-white/10 bg-black/30 px-6 py-10 shadow-2xl shadow-black/50 backdrop-blur sm:px-10">
              <div className="grid gap-10 md:grid-cols-2 md:items-center">
                <div className="text-center md:text-left">
                  <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                      <IconBall className="h-4 w-4 text-emerald-200" />
                      Cobrança de pênaltis em VR
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                      <IconGoal className="h-4 w-4 text-lime-200" />
                      Bola virtual + chute de verdade
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-sm text-white/90">
                      <IconWhistle className="h-4 w-4 text-white/90" />
                      Operação completa no evento
                    </p>
                  </div>

                  <h1 className="mt-7 text-5xl font-semibold leading-[1.06] tracking-tight text-white md:text-6xl">
                    Simulador de Futebol Virtual
                    <span className="block bg-gradient-to-r from-white via-emerald-100 to-lime-100 bg-clip-text text-transparent">
                      cobrança de pênaltis
                    </span>
                  </h1>
                  <p className="mt-5 text-base text-white/85 md:text-lg">
                    Uma ativação rápida de entender, difícil de resistir e perfeita para gerar fila,
                    fotos e desafio entre amigos. Nosso setup coloca o participante no momento mais
                    emocionante do futebol: o pênalti.
                  </p>

                  <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center md:justify-start">
                    <Button
                      asChild
                      size="lg"
                      className="shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-300/35"
                    >
                      <a href={whatsappHref} target="_blank" rel="noreferrer">
                        Pedir orçamento no WhatsApp
                      </a>
                    </Button>
                    <Button asChild intent="secondary" size="lg">
                      <Link href="#como-funciona">Ver como funciona</Link>
                    </Button>
                  </div>

                  <p className="mt-6 text-sm text-zinc-300">
                    Jogo utilizado:{" "}
                    <a
                      href="https://store.steampowered.com/app/555060/Final_Soccer_VR/?l=portuguese"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-200 hover:text-emerald-100"
                    >
                      Final Soccer VR
                    </a>
                    . Nossa licença é focada na experiência de pênaltis (chute ao gol).
                  </p>
                </div>

                <div className="mx-auto w-full max-w-md">
                  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.60)]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-emerald-500/15 via-transparent to-lime-400/10"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-px rounded-3xl ring-1 ring-emerald-300/25"
                    />
                    <div className="relative aspect-[3/4]">
                      <Image
                        src="/simulador-futebol-penalti.jpg"
                        alt="Ativação do simulador de cobrança de pênaltis em realidade virtual em evento"
                        fill
                        sizes="(max-width: 768px) 100vw, 420px"
                        className="object-cover object-[center_20%]"
                        priority
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                      />
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-medium text-white">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" />
                        Ativação real no evento
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-sm font-semibold text-white">
                          Chute de verdade com bola virtual
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                          Experiência rápida, fila constante e desafio entre participantes
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Como funciona</h2>
              <p className="text-sm text-zinc-300">
                O participante veste o headset de realidade virtual e cobra pênaltis com uma bola de
                verdade. A bola é chutada diretamente em uma lona/parede de impacto, com sensor na
                canela para registrar o chute.
              </p>
              <div className="mt-5 grid gap-3">
                <Card>
                  <p className="text-sm font-semibold text-white">Dinâmica em 60 segundos</p>
                  <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-white">
                        1
                      </span>
                      <span>Briefing rápido + ajuste do headset</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-white">
                        2
                      </span>
                      <span>Chute real: posiciona, mira e cobra o pênalti</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-white">
                        3
                      </span>
                      <span>Ranking e repetição: vira desafio e cria fila</span>
                    </li>
                  </ol>
                </Card>
              </div>
            </div>

            <div className="space-y-3">
              <h3 id="o-que-levamos" className="text-xl font-semibold tracking-tight text-white">
                O que levamos
              </h3>
              <Card className="relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%)]"
                />
                <div className="relative">
                  <ul className="space-y-3 text-sm text-zinc-300">
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>PC gamer + jogo configurado</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Headset VR + sensores</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>TV de 40&quot; para a plateia acompanhar</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Montagem, treinamento e operação no evento</span>
                    </li>
                    <li className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Cabos, extensões e checklist de funcionamento</span>
                    </li>
                  </ul>
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold text-white">Cenografia (opcional)</p>
                <p className="mt-2 text-sm text-zinc-300">
                  Podemos operar com cenografia do cliente (lona/piso/prismas) ou entregar a arena
                  completa sob demanda. Informe no orçamento se você quer: “arena pronta” ou “somente
                  tecnologia”.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Por que funciona</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Futebol é universal: todo mundo entende o desafio do pênalti. Em poucos segundos a
                pessoa já sabe o que fazer, e a experiência vira conteúdo e competição.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Alto fluxo</p>
                  <p className="mt-1 text-sm text-zinc-300">Fila anda rápido sem perder impacto.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Experiência “instagramável”</p>
                  <p className="mt-1 text-sm text-zinc-300">Vídeos e fotos com chute real.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Competição natural</p>
                  <p className="mt-1 text-sm text-zinc-300">Ranking, desafios e “valendo”.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Perfeito para marcas</p>
                  <p className="mt-1 text-sm text-zinc-300">Aumenta tempo de permanência no espaço.</p>
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_55%)]"
              />
              <div className="relative">
                <p className="text-sm font-semibold text-white">Peça uma proposta completa</p>
                <p className="mt-2 text-sm text-zinc-300">
                  Enviamos orçamento com montagem, desmontagem, NF, forma de pagamento e promotores se
                  necessário.
                </p>
                <Button asChild className="mt-5 w-full" size="lg">
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    Falar com a VRGH
                  </a>
                </Button>
                <p className="mt-4 text-xs text-zinc-400">
                  Atendimento a partir de São José dos Campos / interior de SP para todo o Brasil.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <Carousel
        id="eventos"
        title="Eventos já realizados"
        description="Algumas ativações e contextos onde a cobrança de pênaltis em VR trouxe fila, engajamento e lembrança de marca."
        items={events}
      />

      <Carousel
        id="clientes"
        title="Empresas que já contrataram"
        description="Clientes que levaram nossa ativação de futebol para eventos, ações de marca e experiências indoor."
        items={companies}
      />

      <section id="orcamento" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                O que você me passa para eu orçar
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>Data(s), horário e duração</span>
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>Local completo (cidade/UF + endereço)</span>
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>Montagem/desmontagem no mesmo dia ou em dias diferentes</span>
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>Se precisa de NF e forma de pagamento</span>
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>Se precisa de cenografia (lona/piso/prismas) e promotores</span>
                </li>
              </ul>
              <Button asChild className="mt-6" size="lg">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  Solicitar orçamento
                </a>
              </Button>
            </Card>

            <Card className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%)]"
              />
              <div className="relative">
                <p className="text-sm font-semibold text-white">Exemplo de briefing</p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm text-zinc-200">Evento: Uniube Aberta</p>
                  <p className="mt-2 text-sm text-zinc-300">Montagem: 22/05</p>
                  <p className="mt-1 text-sm text-zinc-300">Evento: 23/05 (09h às 15h)</p>
                  <p className="mt-1 text-sm text-zinc-300">Desmontagem: 23/05 a partir das 16h</p>
                  <p className="mt-1 text-sm text-zinc-300">Local: UNIUBE • Uberaba/MG</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Observação: enviar orçamento com montagem, desmontagem, NF, forma de pagamento e
                    promotores se necessário.
                  </p>
                </div>
                <p className="mt-4 text-xs text-zinc-400">
                  Você manda isso e eu retorno com a proposta completa.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm text-zinc-300">Quer reservar uma data agora?</p>
              <p className="text-lg font-semibold text-white">
                Fale no WhatsApp e garanta o simulador de pênaltis para o seu evento.
              </p>
            </div>
            <Button asChild size="lg">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                Chamar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Card className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_60%)]"
            />
            <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-sm text-zinc-300">Quer ver outras ativações?</p>
                <p className="text-lg font-semibold text-white">
                  Conheça os outros equipamentos e experiências da VRGH.
                </p>
              </div>
              <Button asChild intent="secondary" size="lg">
                <a href="https://www.vrgh.com.br/#equipamentos" target="_blank" rel="noreferrer">
                  Ver equipamentos no site
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

