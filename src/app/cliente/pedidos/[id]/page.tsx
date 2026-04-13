import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatBRLFromCents } from "@/lib/pricing/calc"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function formatDatePtBR(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("pt-BR", { dateStyle: "short" })
}

function formatDateISOToPtBR(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR", { dateStyle: "short" })
}

function statusAllowsEdit(status: string) {
  return status === "submitted" || status === "in_review"
}

async function updatePedido(formData: FormData) {
  "use server"

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login")

  const id = getString(formData, "id")
  if (!id) redirect("/cliente")

  const currentRes = await supabase.from("reservations").select("id,status,user_id").eq("id", id).maybeSingle()
  const current = currentRes.data as any
  if (!current || current.user_id !== user.id) redirect("/cliente")

  const status = String(current.status ?? "")
  if (!statusAllowsEdit(status)) {
    redirect(`/cliente/pedidos/${id}?view=1&error=${encodeURIComponent("Este pedido não pode mais ser editado.")}`)
  }

  const payload = {
    event_name: getString(formData, "event_name") || null,
    venue_name: getString(formData, "venue_name") || null,
    address_line1: getString(formData, "address_line1") || null,
    address_number: getString(formData, "address_number") || null,
    address_line2: getString(formData, "address_line2") || null,
    neighborhood: getString(formData, "neighborhood") || null,
    city: getString(formData, "city") || null,
    state: getString(formData, "state") || null,
    postal_code: getString(formData, "postal_code") || null,
    notes: getString(formData, "notes") || null
  }

  const upd = await supabase.from("reservations").update(payload).eq("id", id).eq("user_id", user.id)
  if (upd.error) {
    redirect(`/cliente/pedidos/${id}?edit=1&error=${encodeURIComponent(upd.error.message)}`)
  }

  redirect(`/cliente/pedidos/${id}?view=1&ok=1`)
}

export default async function PedidoDetalhePage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: { view?: string; edit?: string; ok?: string; error?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect(`/login?next=/cliente/pedidos/${params.id}`)

  const res = await supabase
    .from("reservations")
    .select(
      "id,status,created_at,total_cents,payment_plan,event_name,venue_name,address_line1,address_number,address_line2,neighborhood,city,state,postal_code,notes,payment_terms,quote_id"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const pedido = res.data as any
  if (!pedido) redirect("/cliente")

  const viewAll = searchParams?.view === "1"
  const edit = searchParams?.edit === "1"
  const ok = searchParams?.ok === "1"
  const error = typeof searchParams?.error === "string" ? searchParams.error : ""

  const canEdit = statusAllowsEdit(String(pedido.status ?? ""))

  const quoteId = typeof pedido.quote_id === "string" ? pedido.quote_id : ""
  const shouldLoadDetails = viewAll || edit

  const quoteRes = shouldLoadDetails && quoteId
    ? await supabase
        .from("quotes")
        .select(
          "id,event_date,event_end_date,start_time,setup_date,setup_time,is_multi_day,duration_hours,distance_km,subtotal_cents,displacement_cents,discount_cents,total_cents,created_at"
        )
        .eq("id", quoteId)
        .maybeSingle()
    : { data: null as any, error: null as any }

  const quote = quoteRes.data as any

  const itemsRes = shouldLoadDetails && quoteId
    ? await supabase
        .from("quote_items")
        .select("id,equipment_id,quantity,unit_price_cents,line_total_cents,equipments(name)")
        .eq("quote_id", quoteId)
    : { data: [] as any[], error: null as any }

  const items = (itemsRes.data ?? []) as any[]

  const addressLine = [
    pedido.address_line1,
    pedido.address_number ? String(pedido.address_number) : "",
    pedido.address_line2 ? String(pedido.address_line2) : ""
  ]
    .filter(Boolean)
    .join(", ")
  const addressCity = [
    pedido.neighborhood ? String(pedido.neighborhood) : "",
    pedido.city ? String(pedido.city) : ""
  ]
    .filter(Boolean)
    .join(" • ")
  const addressState = pedido.state ? String(pedido.state) : ""
  const addressText = [addressLine, [addressCity, addressState ? `/${addressState}` : ""].filter(Boolean).join("")].filter(Boolean).join(" • ")

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Detalhes do pedido</h1>
          <p className="mt-2 text-zinc-300">
            Status: {pedido.status} • Pagamento: {pedido.payment_plan}
          </p>
          {quote?.created_at ? (
            <p className="mt-1 text-sm text-zinc-500">Enviado em {formatDatePtBR(quote.created_at)}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button asChild intent="ghost">
            <Link href="/cliente">Voltar</Link>
          </Button>
          <Button asChild intent="secondary">
            <Link href={`/cliente/pedidos/${pedido.id}${viewAll ? "" : "?view=1"}`}>{viewAll ? "Fechar" : "Ver tudo"}</Link>
          </Button>
          {canEdit ? (
            <Button asChild intent="primary">
              <Link href={`/cliente/pedidos/${pedido.id}?edit=1&view=1`}>Editar</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {ok ? (
        <Card className="mt-6">
          <p className="text-sm text-emerald-200">Pedido atualizado com sucesso.</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="mt-6">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Evento</p>
          <p className="mt-2 font-semibold">{pedido.event_name ?? "—"}</p>
          <p className="mt-1 text-sm text-zinc-300">{pedido.venue_name ?? "—"}</p>
          <p className="mt-3 text-sm text-zinc-300">{addressText || "—"}</p>
          <p className="mt-1 text-sm text-zinc-400">{pedido.postal_code ?? "—"}</p>
        </Card>

        {edit ? (
          <Card>
            <p className="text-sm text-zinc-400">Editar pedido</p>
            <form action={updatePedido} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={pedido.id} />
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200">Nome do evento</label>
                <Input name="event_name" defaultValue={pedido.event_name ?? ""} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200">Local (nome do salão)</label>
                <Input name="venue_name" defaultValue={pedido.venue_name ?? ""} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200">Rua</label>
                <Input name="address_line1" defaultValue={pedido.address_line1 ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">Número</label>
                <Input name="address_number" defaultValue={pedido.address_number ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">Complemento</label>
                <Input name="address_line2" defaultValue={pedido.address_line2 ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">Bairro</label>
                <Input name="neighborhood" defaultValue={pedido.neighborhood ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">Cidade</label>
                <Input name="city" defaultValue={pedido.city ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">UF</label>
                <Input name="state" maxLength={2} defaultValue={pedido.state ?? ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">CEP</label>
                <Input name="postal_code" defaultValue={pedido.postal_code ?? ""} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200">Observações</label>
                <textarea
                  name="notes"
                  defaultValue={pedido.notes ?? ""}
                  className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Salvar alterações</Button>
                <Button asChild intent="ghost">
                  <Link href={`/cliente/pedidos/${pedido.id}?view=1`}>Cancelar</Link>
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-zinc-400">Observações</p>
            <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{pedido.notes ?? "—"}</p>
          </Card>
        )}

        {viewAll && quote ? (
          <>
            <Card>
              <p className="text-sm text-zinc-400">Período</p>
              <div className="mt-3 space-y-1 text-sm text-zinc-300">
                <p>
                  Data: {formatDateISOToPtBR(quote.event_date)} {quote.is_multi_day ? `→ ${formatDateISOToPtBR(quote.event_end_date)}` : ""}
                </p>
                <p>Início: {quote.start_time ?? "—"}</p>
                {quote.is_multi_day ? (
                  <p>
                    Montagem: {formatDateISOToPtBR(quote.setup_date)} • {quote.setup_time ?? "—"}
                  </p>
                ) : (
                  <p>Duração: {typeof quote.duration_hours === "number" ? `${quote.duration_hours}h` : "—"}</p>
                )}
                <p>Distância: {typeof quote.distance_km === "number" ? `${Math.round(quote.distance_km)}km` : "—"}</p>
              </div>
            </Card>

            <Card>
              <p className="text-sm text-zinc-400">Itens</p>
              <div className="mt-3 grid gap-2 text-sm">
                {items.length ? (
                  items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <span className="text-zinc-300">{it.equipments?.name ?? it.equipment_id}</span>
                      <span className="font-semibold text-white">x{it.quantity}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-300">—</p>
                )}
              </div>
            </Card>

            <Card>
              <p className="text-sm text-zinc-400">Total</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Subtotal</span>
                  <span className="font-semibold text-white">{formatBRLFromCents(quote.subtotal_cents ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Deslocamento</span>
                  <span className="font-semibold text-white">{formatBRLFromCents(quote.displacement_cents ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Desconto</span>
                  <span className="font-semibold text-green-300">-{formatBRLFromCents(quote.discount_cents ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-zinc-200">Total</span>
                  <span className="text-lg font-semibold text-white">{formatBRLFromCents(quote.total_cents ?? pedido.total_cents ?? 0)}</span>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}
