import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default function ComoFuncionaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Como funciona</h1>
        <p className="text-zinc-300">
          Do orçamento até a confirmação da reserva, com fluxo pensado para
          produção real.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Orçamento</p>
          <p className="mt-2 font-semibold">Selecione itens e período</p>
          <p className="mt-1 text-sm text-zinc-300">
            Escolha os equipamentos, quantidade, data, duração e região/distância.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Reserva</p>
          <p className="mt-2 font-semibold">Informe dados do evento</p>
          <p className="mt-1 text-sm text-zinc-300">
            Local, data, horário, observações e forma de pagamento.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Confirmação</p>
          <p className="mt-2 font-semibold">Análise e confirmação</p>
          <p className="mt-1 text-sm text-zinc-300">
            Pedido fica com status de análise até confirmação pela equipe.
          </p>
        </Card>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/orcamento">Começar orçamento</Link>
        </Button>
        <Button asChild size="lg" intent="secondary">
          <Link href="/#equipamentos">Ver equipamentos</Link>
        </Button>
      </div>
    </div>
  )
}
