import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default async function AdminPedidosPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/pedidos")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")

  const reservationsRes = await supabase
    .from("reservations")
    .select("id,status,created_at,total_cents,payment_plan,event_name")
    .order("created_at", { ascending: false })
    .limit(50)

  const reservations = reservationsRes.data ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-zinc-300">
          Lista inicial. Próxima etapa: ações de status e detalhamento completo.
        </p>
      </div>

      <div className="mt-8 grid gap-3">
        {reservations.length === 0 ? (
          <Card>
            <p className="text-zinc-300">Nenhum pedido encontrado.</p>
          </Card>
        ) : (
          reservations.map((r: any) => (
            <Card key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{r.event_name ?? "Evento"}</p>
                <p className="text-sm text-zinc-400">
                  Status: {r.status} • Pagamento: {r.payment_plan}
                </p>
              </div>
              <Button asChild intent="secondary">
                <Link href={`/admin/pedidos/${r.id}`}>Detalhes</Link>
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

