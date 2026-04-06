import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { formatBRLFromCents } from "@/lib/pricing/calc"

export default async function AdminPedidoDetalhePage({
  params
}: {
  params: { id: string }
}) {
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
  if (!user) redirect(`/login?next=/admin/pedidos/${params.id}`)

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")

  const res = await supabase
    .from("reservations")
    .select(
      "id,status,created_at,total_cents,payment_plan,event_name,venue_name,address_line1,address_line2,city,state,postal_code,notes,payment_terms,user_id,quote_id,quotes(event_date,start_time,duration_hours,distance_km,subtotal_cents,displacement_cents,discount_cents,total_cents)"
    )
    .eq("id", params.id)
    .maybeSingle()

  const pedido = res.data as any
  if (!pedido) redirect("/admin/pedidos")

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Pedido</h1>
      <p className="mt-2 text-zinc-300">
        ID: {pedido.id} • Status: {pedido.status} • Pagamento: {pedido.payment_plan}
      </p>

      <div className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Cliente</p>
          <p className="mt-2 text-sm text-zinc-300">{pedido.user_id}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Evento</p>
          <p className="mt-2 font-semibold">{pedido.event_name ?? "—"}</p>
          <p className="mt-1 text-sm text-zinc-300">
            Data: {formatDatePtBR(pedido.quotes?.event_date)} • Início:{" "}
            {formatTimeHHmm(pedido.quotes?.start_time)} • Duração:{" "}
            {typeof pedido.quotes?.duration_hours === "number"
              ? `${pedido.quotes.duration_hours}h`
              : "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-300">{pedido.venue_name ?? "—"}</p>
          <p className="mt-3 text-sm text-zinc-300">
            {pedido.address_line1 ?? "—"}
            {pedido.address_line2 ? `, ${pedido.address_line2}` : ""}
            {pedido.city ? ` • ${pedido.city}` : ""}
            {pedido.state ? `/${pedido.state}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{pedido.postal_code ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Financeiro</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">
                {typeof pedido.quotes?.subtotal_cents === "number"
                  ? formatBRLFromCents(pedido.quotes.subtotal_cents)
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deslocamento</span>
              <span className="font-semibold">
                {typeof pedido.quotes?.displacement_cents === "number"
                  ? formatBRLFromCents(pedido.quotes.displacement_cents)
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Desconto</span>
              <span className="font-semibold">
                {typeof pedido.quotes?.discount_cents === "number"
                  ? formatBRLFromCents(pedido.quotes.discount_cents)
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span>Total</span>
              <span className="font-semibold">
                {typeof pedido.total_cents === "number"
                  ? formatBRLFromCents(pedido.total_cents)
                  : "—"}
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Observações</p>
          <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
            {pedido.notes ?? "—"}
          </p>
        </Card>
      </div>
    </div>
  )
}
