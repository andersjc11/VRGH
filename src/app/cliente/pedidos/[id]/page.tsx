import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"

export default async function PedidoDetalhePage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect(`/login?next=/cliente/pedidos/${params.id}`)

  const res = await supabase
    .from("reservations")
    .select(
      "id,status,created_at,total_cents,payment_plan,event_name,venue_name,address_line1,address_line2,city,state,postal_code,notes,payment_terms"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const pedido = res.data as any
  if (!pedido) redirect("/cliente")

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Detalhes do pedido</h1>
      <p className="mt-2 text-zinc-300">
        Status: {pedido.status} • Pagamento: {pedido.payment_plan}
      </p>

      <div className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Evento</p>
          <p className="mt-2 font-semibold">{pedido.event_name ?? "—"}</p>
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
          <p className="text-sm text-zinc-400">Observações</p>
          <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
            {pedido.notes ?? "—"}
          </p>
        </Card>
      </div>
    </div>
  )
}

