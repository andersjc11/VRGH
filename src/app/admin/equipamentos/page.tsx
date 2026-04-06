import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"

export default async function AdminEquipamentosPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/equipamentos")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")

  const equipmentsRes = await supabase
    .from("equipments")
    .select("id,name,category,active,created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const equipments = equipmentsRes.data ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Equipamentos</h1>
        <p className="text-zinc-300">
          Base inicial do painel. CRUD completo entra na próxima etapa.
        </p>
      </div>

      <div className="mt-8 grid gap-3">
        {equipments.length === 0 ? (
          <Card>
            <p className="text-zinc-300">Nenhum equipamento cadastrado.</p>
          </Card>
        ) : (
          equipments.map((e: any) => (
            <Card key={e.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-sm text-zinc-400">
                  {e.category ?? "—"} • {e.active ? "Ativo" : "Inativo"}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

