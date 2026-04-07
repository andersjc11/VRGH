import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { calcDisplacementCents, formatBRLFromCents } from "@/lib/pricing/calc"

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseMoneyToCents(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim()
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function parseSignedMoneyToCents(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim()
  if (!cleaned) return 0
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}

function parseNumber(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim().replace(",", ".")
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parseIntSafe(raw: string) {
  const n = parseNumber(raw)
  if (n === null) return null
  return Math.trunc(n)
}

function isNextRedirectError(err: unknown) {
  const digest = (err as any)?.digest
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT")
}

function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  )
}

function normalizeReferralCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

async function awardCashbackForReservation(reservationId: string) {
  const admin = createSupabaseAdminClient()

  const reservationRes = await admin
    .from("reservations")
    .select("id,user_id,condominium_id,payment_terms")
    .eq("id", reservationId)
    .maybeSingle()

  if (reservationRes.error) throw new Error(reservationRes.error.message)
  const reservation = reservationRes.data as any
  if (!reservation?.user_id) return

  const referredId = reservation.user_id as string
  const paymentTerms = reservation.payment_terms as any

  const referredProfileRes = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", referredId)
    .maybeSingle()
  if (referredProfileRes.error) throw new Error(referredProfileRes.error.message)

  let referrerId = typeof referredProfileRes.data?.referred_by === "string" ? referredProfileRes.data.referred_by : ""
  if (!referrerId) {
    const refFromPaymentTerms = normalizeReferralCode(paymentTerms?.ref)
    if (refFromPaymentTerms) {
      const referrerRes = await admin
        .from("profiles")
        .select("id")
        .eq("referral_code", refFromPaymentTerms)
        .maybeSingle()
      if (referrerRes.error) throw new Error(referrerRes.error.message)
      referrerId = typeof referrerRes.data?.id === "string" ? referrerRes.data.id : ""
    }
  }

  if (!referrerId || referrerId === referredId) return

  const referrerProfileRes = await admin.from("profiles").select("role").eq("id", referrerId).maybeSingle()
  if (referrerProfileRes.error) throw new Error(referrerProfileRes.error.message)

  const referrerRole = String(referrerProfileRes.data?.role ?? "")
  const condominiumId = typeof reservation.condominium_id === "string" ? reservation.condominium_id : null

  if (referrerRole === "sindico" && !condominiumId) return

  const referralUpsertRes = await admin
    .from("referrals")
    .upsert(
      {
        referrer_id: referrerId,
        referred_id: referredId,
        condominium_id: referrerRole === "sindico" ? condominiumId : null,
        reservation_id: reservationId,
        cashback_cents: 1000,
        status: "approved"
      },
      { onConflict: "referred_id,reservation_id" }
    )
    .select("id")
    .maybeSingle()

  if (referralUpsertRes.error) throw new Error(referralUpsertRes.error.message)
  const referralId = typeof referralUpsertRes.data?.id === "string" ? referralUpsertRes.data.id : ""
  if (!referralId) return

  const cashbackPayload =
    referrerRole === "sindico"
      ? {
          owner_profile_id: null,
          owner_condominium_id: condominiumId,
          amount_cents: 1000,
          status: "approved",
          source_referral_id: referralId
        }
      : {
          owner_profile_id: referrerId,
          owner_condominium_id: null,
          amount_cents: 1000,
          status: "approved",
          source_referral_id: referralId
        }

  const cashbackUpsertRes = await admin
    .from("cashback_transactions")
    .upsert(cashbackPayload, { onConflict: "source_referral_id" })

  if (cashbackUpsertRes.error) throw new Error(cashbackUpsertRes.error.message)
}

async function cancelCashbackForReservation(reservationId: string) {
  const admin = createSupabaseAdminClient()
  const referralRes = await admin.from("referrals").select("id").eq("reservation_id", reservationId).maybeSingle()
  if (referralRes.error) throw new Error(referralRes.error.message)
  const referralId = typeof referralRes.data?.id === "string" ? referralRes.data.id : ""
  if (!referralId) return

  const updReferral = await admin.from("referrals").update({ status: "cancelled" }).eq("id", referralId)
  if (updReferral.error) throw new Error(updReferral.error.message)

  const updCashback = await admin
    .from("cashback_transactions")
    .update({ status: "cancelled" })
    .eq("source_referral_id", referralId)
  if (updCashback.error) throw new Error(updCashback.error.message)
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "submitted":
      return "Solicitação enviada"
    case "in_review":
      return "Aguardando confirmação de pagamento"
    case "confirmed":
      return "Pagamento realizado"
    case "cancelled":
      return "Reserva cancelada"
    case "completed":
      return "Reserva concluída"
    default:
      return status ?? "—"
  }
}

export default async function AdminPedidoDetalhePage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: { ok?: string; error?: string; print?: string }
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
      "id,status,created_at,total_cents,payment_plan,event_name,venue_name,address_line1,address_number,address_line2,neighborhood,city,state,postal_code,notes,payment_terms,user_id,profiles(full_name,cpf,phone,whatsapp,address_line1,neighborhood,city,postal_code),quote_id,quotes(event_date,start_time,duration_hours,distance_km,subtotal_cents,displacement_cents,discount_cents,total_cents)"
    )
    .eq("id", params.id)
    .maybeSingle()

  const pedido = res.data as any
  if (!pedido) redirect("/admin/pedidos")

  const displacementSettingsRes = await supabase
    .from("pricing_settings")
    .select("value_json")
    .eq("key", "displacement")
    .maybeSingle()

  const displacementConfig = {
    base_fee_cents: displacementSettingsRes.data?.value_json?.base_fee_cents ?? 0,
    free_km: displacementSettingsRes.data?.value_json?.free_km ?? 10,
    per_km_cents: displacementSettingsRes.data?.value_json?.per_km_cents ?? 500
  }

  const quoteId = pedido.quote_id as string | null | undefined
  const quoteItemsResWithEquip = quoteId
    ? await supabase
        .from("quote_items")
        .select("id,equipment_id,quantity,unit_price_cents,line_total_cents,equipments(name)")
        .eq("quote_id", quoteId)
        .order("id", { ascending: true })
    : { data: [], error: null }

  const quoteItemsRes =
    quoteItemsResWithEquip.error && quoteId
      ? await supabase
          .from("quote_items")
          .select("id,equipment_id,quantity,unit_price_cents,line_total_cents")
          .eq("quote_id", quoteId)
          .order("id", { ascending: true })
      : quoteItemsResWithEquip

  const quoteItems = (quoteItemsRes.data ?? []) as any[]

  async function savePedido(formData: FormData) {
    "use server"
    try {
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

      const reservationId = getString(formData, "reservation_id")
      const quoteId = getString(formData, "quote_id")
      if (!reservationId) redirect(`/admin/pedidos/${params.id}?error=ID%20inv%C3%A1lido`)
      if (!quoteId) redirect(`/admin/pedidos/${params.id}?error=Or%C3%A7amento%20n%C3%A3o%20encontrado`)

      const eventName = getString(formData, "event_name") || null
      const venueName = getString(formData, "venue_name") || null
      const addressLine1 = getString(formData, "address_line1") || null
      const addressNumber = getString(formData, "address_number") || null
      const addressLine2 = getString(formData, "address_line2") || null
      const neighborhood = getString(formData, "neighborhood") || null
      const city = getString(formData, "city") || null
      const state = getString(formData, "state") || null
      const postalCode = getString(formData, "postal_code") || null
      const notes = getString(formData, "notes") || null

      const eventDate = getString(formData, "event_date") || null
      const startTime = getString(formData, "start_time") || null
      const durationHours = parseIntSafe(getString(formData, "duration_hours"))
      const distanceKm = parseNumber(getString(formData, "distance_km"))

      if (durationHours === null || durationHours < 1) {
        redirect(`/admin/pedidos/${params.id}?error=Dura%C3%A7%C3%A3o%20inv%C3%A1lida`)
      }
      if (distanceKm === null || distanceKm < 0) {
        redirect(`/admin/pedidos/${params.id}?error=Dist%C3%A2ncia%20inv%C3%A1lida`)
      }

      const displacementSettingsRes = await supabase
        .from("pricing_settings")
        .select("value_json")
        .eq("key", "displacement")
        .maybeSingle()

      const displacementConfig = {
        base_fee_cents: displacementSettingsRes.data?.value_json?.base_fee_cents ?? 0,
        free_km: displacementSettingsRes.data?.value_json?.free_km ?? 10,
        per_km_cents: displacementSettingsRes.data?.value_json?.per_km_cents ?? 500
      }

      const displacementAdjustmentCents = parseSignedMoneyToCents(
        getString(formData, "displacement_adjustment")
      )
      if (displacementAdjustmentCents === null) {
        redirect(`/admin/pedidos/${params.id}?error=Ajuste%20de%20deslocamento%20inv%C3%A1lido`)
      }

      const displacementBaseCents = calcDisplacementCents({
        distanceKm,
        config: displacementConfig
      })

      const displacementCents = Math.max(0, displacementBaseCents + displacementAdjustmentCents)
      const discountCents = parseMoneyToCents(getString(formData, "discount"))

      if (discountCents === null) {
        redirect(`/admin/pedidos/${params.id}?error=Desconto%20inv%C3%A1lido`)
      }

      const status = getString(formData, "status")
      const allowedStatus = new Set(["draft", "submitted", "in_review", "confirmed", "cancelled", "completed"])
      if (status && !allowedStatus.has(status)) {
        redirect(`/admin/pedidos/${params.id}?error=Status%20inv%C3%A1lido`)
      }

      const paymentPlan = getString(formData, "payment_plan") || "pix"

      const itemIdsRaw = getString(formData, "item_ids")
      const itemIds = itemIdsRaw
        ? itemIdsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      let subtotalCents = 0
      const existingItemsRes =
        itemIds.length > 0
          ? await supabase
              .from("quote_items")
              .select("id,quote_id,equipment_id")
              .in("id", itemIds)
          : { data: [], error: null }

      if (existingItemsRes.error) {
        redirect(
          `/admin/pedidos/${params.id}?error=${encodeURIComponent(
            `Falha ao carregar itens: ${existingItemsRes.error.message}`
          )}`
        )
      }

      const equipmentIdByItemId = Object.fromEntries(
        (existingItemsRes.data ?? []).map((row: any) => [row.id, row.equipment_id])
      ) as Record<string, string | undefined>

      const missingItemIds = itemIds.filter((id) => !equipmentIdByItemId[id])
      if (missingItemIds.length > 0) {
        redirect(
          `/admin/pedidos/${params.id}?error=${encodeURIComponent(
            `Itens não encontrados: ${missingItemIds.join(", ")}`
          )}`
        )
      }

      const itemsToUpsert = itemIds.map((id) => {
        const qty = parseIntSafe(getString(formData, `item_${id}_qty`))
        const unitCents = parseMoneyToCents(getString(formData, `item_${id}_unit`))
        if (qty === null || qty < 0) {
          redirect(`/admin/pedidos/${params.id}?error=Quantidade%20inv%C3%A1lida`)
        }
        if (unitCents === null) {
          redirect(`/admin/pedidos/${params.id}?error=Pre%C3%A7o%20inv%C3%A1lido`)
        }
        const lineTotal = qty * unitCents * durationHours
        subtotalCents += lineTotal
        return {
          id,
          quote_id: quoteId,
          equipment_id: equipmentIdByItemId[id],
          quantity: qty,
          unit_price_cents: unitCents,
          line_total_cents: lineTotal
        }
      })

      if (itemsToUpsert.length === 0) {
        const currentQuoteRes = await supabase
          .from("quotes")
          .select("subtotal_cents")
          .eq("id", quoteId)
          .maybeSingle()

        subtotalCents =
          typeof currentQuoteRes.data?.subtotal_cents === "number"
            ? currentQuoteRes.data.subtotal_cents
            : 0
      }

      const totalCents = Math.max(0, subtotalCents + displacementCents - discountCents)

      if (itemsToUpsert.length > 0) {
        const itemsRes = await supabase
          .from("quote_items")
          .upsert(itemsToUpsert, { onConflict: "id" })

        if (itemsRes.error) {
          redirect(
            `/admin/pedidos/${params.id}?error=${encodeURIComponent(
              `Falha ao salvar itens: ${itemsRes.error.message}`
            )}`
          )
        }
      }

      const quoteRes = await supabase
        .from("quotes")
        .update({
          event_date: eventDate,
          start_time: startTime,
          duration_hours: durationHours,
          distance_km: distanceKm,
          subtotal_cents: subtotalCents,
          displacement_cents: displacementCents,
          discount_cents: discountCents,
          total_cents: totalCents
        })
        .eq("id", quoteId)

      if (quoteRes.error) {
        redirect(
          `/admin/pedidos/${params.id}?error=${encodeURIComponent(
            `Falha ao salvar orçamento: ${quoteRes.error.message}`
          )}`
        )
      }

      const reservationRes = await supabase
        .from("reservations")
        .update({
          ...(status ? { status } : {}),
          event_name: eventName,
          venue_name: venueName,
          address_line1: addressLine1,
          address_number: addressNumber,
          address_line2: addressLine2,
          neighborhood,
          city,
          state,
          postal_code: postalCode,
          notes,
          payment_plan: paymentPlan,
          total_cents: totalCents
        })
        .eq("id", reservationId)

      if (reservationRes.error) {
        redirect(
          `/admin/pedidos/${params.id}?error=${encodeURIComponent(
            `Falha ao salvar pedido: ${reservationRes.error.message}`
          )}`
        )
      }

      if (status === "confirmed" || status === "completed") {
        await awardCashbackForReservation(reservationId)
      } else if (status === "cancelled") {
        await cancelCashbackForReservation(reservationId)
      }

      redirect(`/admin/pedidos/${params.id}?ok=1`)
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
      redirect(`/admin/pedidos/${params.id}?error=${encodeURIComponent(message)}`)
    }
  }

  const ok = searchParams?.ok
  const error = searchParams?.error
  const isPrint = searchParams?.print === "1"

  const durationHours = typeof pedido.quotes?.duration_hours === "number" ? pedido.quotes.duration_hours : 1
  const subtotalCents = typeof pedido.quotes?.subtotal_cents === "number" ? pedido.quotes.subtotal_cents : 0
  const displacementCents =
    typeof pedido.quotes?.displacement_cents === "number" ? pedido.quotes.displacement_cents : 0
  const discountCents =
    typeof pedido.quotes?.discount_cents === "number" ? pedido.quotes.discount_cents : 0
  const totalCents = Math.max(0, subtotalCents + displacementCents - discountCents)
  const distanceKm =
    typeof pedido.quotes?.distance_km === "number"
      ? pedido.quotes.distance_km
      : Number(pedido.quotes?.distance_km ?? 0) || 0
  const displacementBaseCents = calcDisplacementCents({
    distanceKm,
    config: displacementConfig
  })
  const displacementAdjustmentCents = displacementCents - displacementBaseCents

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div
        className={
          isPrint
            ? "print:block"
            : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:block"
        }
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pedido</h1>
          <p className="mt-2 text-zinc-300">
            ID: {pedido.id} • Status: {statusLabel(pedido.status)} • Pagamento:{" "}
            {pedido.payment_plan}
          </p>
          {isPrint ? (
            <p className="mt-2 text-sm text-zinc-300 print:hidden">
              Use Ctrl+P para imprimir ou salvar como PDF.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 print:hidden">
          <Button asChild intent="secondary">
            <Link
              href={`/admin/pedidos/${pedido.id}?print=1`}
              target="_blank"
              rel="noreferrer"
            >
              Imprimir / PDF
            </Link>
          </Button>
          <Button asChild intent="ghost">
            <Link href="/admin/pedidos">Voltar</Link>
          </Button>
        </div>
      </div>

      {ok || error ? (
        <Card className="mt-6 print:hidden">
          {ok ? <p className="text-sm text-emerald-200">Atualizado com sucesso.</p> : null}
          {error ? (
            <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Contratante</p>
          <p className="mt-2 font-semibold">
            {pedido.profiles?.full_name ?? pedido.user_id ?? "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            CPF: {pedido.profiles?.cpf ?? "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Contato: {pedido.profiles?.whatsapp ?? pedido.profiles?.phone ?? "—"}
          </p>
          <p className="mt-3 text-sm text-zinc-300">
            {pedido.profiles?.address_line1 ?? "—"}
            {pedido.profiles?.neighborhood ? ` • ${pedido.profiles.neighborhood}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {pedido.profiles?.city ?? "—"} • {pedido.profiles?.postal_code ?? "—"}
          </p>
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
            {pedido.address_number ? `, ${pedido.address_number}` : ""}
            {pedido.address_line2 ? `, ${pedido.address_line2}` : ""}
            {pedido.neighborhood ? ` • ${pedido.neighborhood}` : ""}
            {pedido.city ? ` • ${pedido.city}` : ""}
            {pedido.state ? `/${pedido.state}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{pedido.postal_code ?? "—"}</p>
        </Card>

        {isPrint ? null : (
          <Card className="print:hidden">
            <p className="text-sm text-zinc-400">Editar pedido</p>
            <form action={savePedido} className="mt-4 grid gap-4">
              <input type="hidden" name="reservation_id" value={pedido.id} />
              <input type="hidden" name="quote_id" value={quoteId ?? ""} />
              <input type="hidden" name="item_ids" value={quoteItems.map((i) => i.id).join(",")} />

              <div className="space-y-1">
                <p className="text-sm text-zinc-200">Status</p>
                <select
                  name="status"
                  defaultValue={pedido.status ?? "submitted"}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="submitted">Solicitação enviada</option>
                  <option value="in_review">Aguardando confirmação de pagamento</option>
                  <option value="confirmed">Pagamento realizado</option>
                  <option value="cancelled">Reserva cancelada</option>
                  <option value="completed">Reserva concluída</option>
                </select>
                <p className="text-xs text-zinc-400">
                  Ao marcar como “Pagamento realizado”, o cashback de indicação é gerado automaticamente.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Nome do evento</p>
                  <Input name="event_name" defaultValue={pedido.event_name ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Local (nome)</p>
                  <Input name="venue_name" defaultValue={pedido.venue_name ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Data</p>
                  <Input
                    type="date"
                    name="event_date"
                    defaultValue={pedido.quotes?.event_date ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Início</p>
                  <Input
                    type="time"
                    name="start_time"
                    defaultValue={formatTimeHHmm(pedido.quotes?.start_time) === "—" ? "" : formatTimeHHmm(pedido.quotes?.start_time)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Duração (h)</p>
                  <Input
                    inputMode="numeric"
                    name="duration_hours"
                    defaultValue={String(pedido.quotes?.duration_hours ?? 1)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Distância (km)</p>
                  <Input
                    inputMode="decimal"
                    name="distance_km"
                    defaultValue={String(pedido.quotes?.distance_km ?? 0)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm text-zinc-200">Endereço</p>
                  <Input name="address_line1" defaultValue={pedido.address_line1 ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Número</p>
                  <Input name="address_number" defaultValue={pedido.address_number ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Bairro</p>
                  <Input name="neighborhood" defaultValue={pedido.neighborhood ?? ""} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm text-zinc-200">Complemento</p>
                  <Input name="address_line2" defaultValue={pedido.address_line2 ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Cidade</p>
                  <Input name="city" defaultValue={pedido.city ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Estado</p>
                  <Input name="state" defaultValue={pedido.state ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">CEP</p>
                  <Input name="postal_code" defaultValue={pedido.postal_code ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Plano de pagamento</p>
                  <select
                    name="payment_plan"
                    defaultValue={pedido.payment_plan ?? "pix"}
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="pix">Pix</option>
                    <option value="deposit">Sinal</option>
                    <option value="installments">Parcelado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-zinc-200">Observações</p>
                <textarea
                  name="notes"
                  defaultValue={pedido.notes ?? ""}
                  className="min-h-28 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-zinc-200">Itens (valores por hora)</p>
                {quoteItems.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
                    Nenhum item encontrado para este orçamento.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {quoteItems.map((it: any) => (
                      <div
                        key={it.id}
                        className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-12 sm:items-end"
                      >
                        <div className="sm:col-span-5">
                          <p className="text-sm text-zinc-100">
                            {it.equipments?.name ?? it.equipment_id ?? "Item"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">ID: {it.id}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs text-zinc-300">Qtd</p>
                          <Input
                            inputMode="numeric"
                            name={`item_${it.id}_qty`}
                            defaultValue={String(it.quantity ?? 0)}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <p className="text-xs text-zinc-300">Valor/h (R$)</p>
                          <Input
                            inputMode="decimal"
                            name={`item_${it.id}_unit`}
                            defaultValue={((Number(it.unit_price_cents ?? 0) / 100) as number).toFixed(2)}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs text-zinc-400">Linha</p>
                          <p className="mt-2 text-sm font-semibold text-zinc-100">
                            {typeof it.line_total_cents === "number"
                              ? formatBRLFromCents(it.line_total_cents)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Deslocamento calculado</p>
                  <div className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white flex items-center">
                    {formatBRLFromCents(displacementBaseCents)}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Atualiza ao salvar quando você altera a distância.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Ajuste de deslocamento (R$)</p>
                  <Input
                    inputMode="decimal"
                    name="displacement_adjustment"
                    defaultValue={(displacementAdjustmentCents / 100).toFixed(2).replace(".", ",")}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Desconto (R$)</p>
                  <Input
                    inputMode="decimal"
                    name="discount"
                    defaultValue={(discountCents / 100).toFixed(2)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-400">Total</p>
                  <div className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white flex items-center">
                    {formatBRLFromCents(totalCents)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button asChild intent="secondary">
                  <Link href={`/admin/pedidos/${pedido.id}`}>Cancelar</Link>
                </Button>
                <Button type="submit">Salvar alterações</Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <p className="text-sm text-zinc-400">Financeiro</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">
                {formatBRLFromCents(subtotalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deslocamento</span>
              <span className="font-semibold">
                {formatBRLFromCents(displacementCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Desconto</span>
              <span className="font-semibold">
                {formatBRLFromCents(discountCents)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span>Total</span>
              <span className="font-semibold">
                {formatBRLFromCents(totalCents)}
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Itens</p>
          {quoteItemsRes.error ? (
            <p className="mt-2 text-sm text-red-300">{quoteItemsRes.error.message}</p>
          ) : quoteItems.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-300">Nenhum item encontrado.</p>
          ) : (
            <div className="mt-3 grid gap-2 text-sm text-zinc-300">
              {quoteItems.map((it: any) => (
                <div
                  key={it.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-zinc-100">
                      {it.equipments?.name ?? it.equipment_id ?? "Item"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Qtd: {it.quantity ?? "—"} • Valor/h:{" "}
                      {typeof it.unit_price_cents === "number"
                        ? formatBRLFromCents(it.unit_price_cents)
                        : "—"}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {typeof it.line_total_cents === "number"
                      ? formatBRLFromCents(it.line_total_cents)
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
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
