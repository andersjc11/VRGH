import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Equipment, EquipmentPrice, PricingConfig } from "@/lib/domain/types"
import { OrcamentoForm } from "./OrcamentoForm"

export const dynamic = "force-dynamic"

function isMissingColumnError(err: unknown, column: string) {
  const message = (err as any)?.message
  if (typeof message !== "string") return false
  return message.toLowerCase().includes(`column "${column.toLowerCase()}" does not exist`)
}

function normalizeCondoCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

function readCondoDiscountPct(valueJson: any, condoCode: string) {
  if (!condoCode) return 0
  const list = Array.isArray(valueJson) ? valueJson : Array.isArray(valueJson?.items) ? valueJson.items : []
  for (const row of list) {
    const code = normalizeCondoCode(row?.code)
    const active = row?.active
    const pct = Number(row?.discount_pct)
    if (code && code === condoCode && active !== false) {
      if (Number.isFinite(pct) && pct > 0) return Math.max(0, Math.min(100, Math.trunc(pct)))
      return 0
    }
  }
  return 0
}

export default async function OrcamentoPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const rawRef = searchParams?.ref
  const ref = typeof rawRef === "string" ? rawRef.trim() : ""
  const condoCode = normalizeCondoCode(searchParams?.condo)
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const isAuthenticated = Boolean(user)

  const [equipmentsResWithQty, pricesRes, displacementRes, discountsRes, condominiumsRes] =
    await Promise.all([
      supabase
        .from("equipments")
        .select("id,name,description,category,image_url,active,quantity_total")
        .eq("active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("equipment_prices")
        .select(
          "equipment_id,price_per_hour_cents,min_hours,price_per_day_cents,price_per_day_block_cents,discount_2_items_pct,discount_3_items_pct"
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("pricing_settings")
        .select("value_json")
        .eq("key", "displacement")
        .maybeSingle(),
      supabase
        .from("pricing_settings")
        .select("value_json")
        .eq("key", "discounts")
        .maybeSingle(),
      supabase
        .from("pricing_settings")
        .select("value_json")
        .eq("key", "condominiums")
        .maybeSingle()
    ])

  const equipmentsRes =
    equipmentsResWithQty.error && isMissingColumnError(equipmentsResWithQty.error, "quantity_total")
      ? await supabase
          .from("equipments")
          .select("id,name,description,category,image_url,active")
          .eq("active", true)
          .order("created_at", { ascending: true })
      : equipmentsResWithQty

  const pricesResFinal =
    pricesRes.error &&
    (isMissingColumnError(pricesRes.error, "price_per_day_cents") ||
      isMissingColumnError(pricesRes.error, "discount_2_items_pct"))
      ? await supabase
          .from("equipment_prices")
          .select("equipment_id,price_per_hour_cents,min_hours")
          .order("created_at", { ascending: true })
      : pricesRes

  const equipments = (equipmentsRes.data ?? []) as Equipment[]
  const prices = (pricesResFinal.data ?? []) as EquipmentPrice[]

  const config: PricingConfig = {
    displacement: {
      base_fee_cents: displacementRes.data?.value_json?.base_fee_cents ?? 0,
      free_km: displacementRes.data?.value_json?.free_km ?? 10,
      per_km_cents: displacementRes.data?.value_json?.per_km_cents ?? 500
    },
    discounts: {
      pix_discount_pct: discountsRes.data?.value_json?.pix_discount_pct ?? 5,
      deposit_pct: discountsRes.data?.value_json?.deposit_pct ?? 30,
      max_installments: discountsRes.data?.value_json?.max_installments ?? 6
    }
  }

  const condoDiscountPct = readCondoDiscountPct(condominiumsRes.data?.value_json, condoCode)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Orçamento</h1>
        <p className="text-zinc-300">
          Preencha os dados e monte seu orçamento. Para enviar a solicitação de reserva, faça login no final.
        </p>
      </div>

      <OrcamentoForm
        equipments={equipments}
        prices={prices}
        config={config}
        refCode={ref || undefined}
        condoCode={condoCode || undefined}
        condoDiscountPct={condoDiscountPct}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
