import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default async function AdminPedidosPage() {
  function formatDatePtBR(dateValue: string | null | undefined) {
    if (!dateValue) return "—"
    const d = new Date(`${dateValue}T00:00:00`)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("pt-BR")
  }

  function formatTimeHHmm(timeValue: string | null | undefined) {
    if (!timeValue) return "—"
    const cleaned = timeValue.trim()
    if (!cleaned) return "—"
    return cleaned.slice(0, 5)
  }

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
    .select(
      "id,status,created_at,total_cents,payment_plan,event_name,quote_id,quotes(event_date,start_time,duration_hours)"
    )
    .order("created_at", { ascending: false })
    .limit(50)

  const reservations = reservationsRes.data ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-zinc-300">
          Operação: acompanhe pedidos e dados do evento.
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
                <p className="mt-1 text-sm text-zinc-300">
                  Data: {formatDatePtBR(r.quotes?.event_date)} • Início:{" "}
                  {formatTimeHHmm(r.quotes?.start_time)} • Duração:{" "}
                  {typeof r.quotes?.duration_hours === "number" ? `${r.quotes.duration_hours}h` : "—"}
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
