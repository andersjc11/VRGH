import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Equipment, EquipmentPrice, PricingConfig } from "@/lib/domain/types"
import { OrcamentoForm } from "./OrcamentoForm"

export const dynamic = "force-dynamic"

export default async function OrcamentoPage() {
  const supabase = createSupabaseServerClient()

  const [equipmentsRes, pricesRes, displacementRes, discountsRes] =
    await Promise.all([
      supabase
        .from("equipments")
        .select("id,name,description,category,image_url,active")
        .eq("active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("equipment_prices")
        .select("equipment_id,price_per_hour_cents,min_hours")
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
        .maybeSingle()
    ])

  const equipments = (equipmentsRes.data ?? []) as Equipment[]
  const prices = (pricesRes.data ?? []) as EquipmentPrice[]

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Orçamento</h1>
        <p className="text-zinc-300">
          Selecione os itens, informe período e local. Para enviar a reserva, você
          precisa estar logado.
        </p>
      </div>

      <OrcamentoForm equipments={equipments} prices={prices} config={config} />
    </div>
  )
}
