import { Card } from "@/components/ui/Card"

export default function CoberturaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cobertura</h1>
        <p className="text-zinc-300">
          O orçamento considera taxa de deslocamento por distância/região.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Modelo</p>
          <p className="mt-2 font-semibold">Taxa por km</p>
          <p className="mt-1 text-sm text-zinc-300">
            A partir de um raio gratuito, o sistema aplica tarifa por km.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Modelo</p>
          <p className="mt-2 font-semibold">Taxa base</p>
          <p className="mt-1 text-sm text-zinc-300">
            Pode existir uma taxa mínima dependendo do município/bairro.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Configuração</p>
          <p className="mt-2 font-semibold">Ajustável no admin</p>
          <p className="mt-1 text-sm text-zinc-300">
            Regras e valores ficam centralizados em configurações de pricing.
          </p>
        </Card>
      </div>
    </div>
  )
}

