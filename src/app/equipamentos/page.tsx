import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"

type EquipmentRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
}

export default async function EquipamentosPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from("equipments")
    .select("id,name,description,category,image_url")
    .eq("active", true)
    .order("created_at", { ascending: true })

  const equipments = (data ?? []) as EquipmentRow[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Equipamentos</h1>
        <p className="text-zinc-300">
          Selecione itens para montar seu orçamento automático.
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
              <p className="text-sm text-zinc-400">
                {eq.category ?? "Equipamento"}
              </p>
              <p className="mt-2 font-semibold">{eq.name}</p>
              <p className="mt-1 text-sm text-zinc-300">
                {eq.description ?? "—"}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

