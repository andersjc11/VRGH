"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { PaymentPlanType, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown } from "@/lib/pricing/calc"

export type CreateReservationState = {
  error?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function getInt(formData: FormData, key: string) {
  const raw = getString(formData, key)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key).replace(",", ".")
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseItems(json: string): QuoteItemInput[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => ({
        equipmentId: typeof x?.equipmentId === "string" ? x.equipmentId : "",
        quantity: typeof x?.quantity === "number" ? x.quantity : Number(x?.quantity)
      }))
      .filter((x) => x.equipmentId && Number.isFinite(x.quantity) && x.quantity > 0)
  } catch {
    return []
  }
}

export async function createReservation(
  _prevState: CreateReservationState,
  formData: FormData
): Promise<CreateReservationState> {
  const supabase = createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) redirect("/login?next=/orcamento")

  const profileRes = await supabase
    .from("profiles")
    .select("full_name,cpf,address_line1,neighborhood,city,postal_code,whatsapp,phone")
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRes.data as any
  const missingClientData =
    !profile?.full_name ||
    !profile?.cpf ||
    !profile?.address_line1 ||
    !profile?.neighborhood ||
    !profile?.city ||
    !profile?.postal_code ||
    !(profile?.whatsapp || profile?.phone)

  if (missingClientData) {
    return {
      error:
        "Antes de enviar a reserva, preencha seus Dados do Cliente em /cliente/dados."
    }
  }

  const itemsJson = getString(formData, "items_json")
  const items = parseItems(itemsJson)
  if (items.length === 0) return { error: "Selecione pelo menos 1 item." }

  const durationHours = Math.max(1, getInt(formData, "duration_hours"))
  const distanceKm = Math.max(0, getNumber(formData, "distance_km"))
  const paymentPlan = getString(formData, "payment_plan") as PaymentPlanType

  const { data: pricesData } = await supabase
    .from("equipment_prices")
    .select("equipment_id,price_per_hour_cents,min_hours")
    .in(
      "equipment_id",
      items.map((i) => i.equipmentId)
    )

  const priceByEquipmentId = Object.fromEntries(
    (pricesData ?? []).map((p: any) => [
      p.equipment_id,
      {
        equipment_id: p.equipment_id,
        price_per_hour_cents: p.price_per_hour_cents,
        min_hours: p.min_hours
      }
    ])
  )

  const { data: displacementSetting } = await supabase
    .from("pricing_settings")
    .select("value_json")
    .eq("key", "displacement")
    .maybeSingle()

  const { data: discountsSetting } = await supabase
    .from("pricing_settings")
    .select("value_json")
    .eq("key", "discounts")
    .maybeSingle()

  const config = {
    displacement: {
      base_fee_cents: displacementSetting?.value_json?.base_fee_cents ?? 0,
      free_km: displacementSetting?.value_json?.free_km ?? 10,
      per_km_cents: displacementSetting?.value_json?.per_km_cents ?? 500
    },
    discounts: {
      pix_discount_pct: discountsSetting?.value_json?.pix_discount_pct ?? 5,
      deposit_pct: discountsSetting?.value_json?.deposit_pct ?? 30,
      max_installments: discountsSetting?.value_json?.max_installments ?? 6
    }
  }

  const breakdown = calcQuoteBreakdown({
    items,
    durationHours,
    distanceKm,
    paymentPlan,
    priceByEquipmentId,
    config
  })

  const eventName = getString(formData, "event_name")
  const venueName = getString(formData, "venue_name")
  const addressLine1 = getString(formData, "address_line1")
  const addressLine2 = getString(formData, "address_line2")
  const city = getString(formData, "city")
  const state = getString(formData, "state")
  const postalCode = getString(formData, "postal_code")
  const notes = getString(formData, "notes")
  const eventDate = getString(formData, "event_date") || null
  const startTime = getString(formData, "start_time") || null

  const quoteInsert = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      event_date: eventDate,
      start_time: startTime,
      duration_hours: durationHours,
      distance_km: distanceKm,
      subtotal_cents: breakdown.subtotal_cents,
      displacement_cents: breakdown.displacement_cents,
      discount_cents: breakdown.discount_cents,
      total_cents: breakdown.total_cents
    })
    .select("id")
    .single()

  if (quoteInsert.error) return { error: "Falha ao criar orçamento." }

  const quoteId = quoteInsert.data.id as string

  const quoteItemsRows = items.map((i) => {
    const price = priceByEquipmentId[i.equipmentId]
    const unit = price?.price_per_hour_cents ?? 0
    const billableHours = Math.max(durationHours, price?.min_hours ?? 1)
    const lineTotal = unit * billableHours * i.quantity
    return {
      quote_id: quoteId,
      equipment_id: i.equipmentId,
      quantity: i.quantity,
      unit_price_cents: unit,
      line_total_cents: lineTotal
    }
  })

  const quoteItemsInsert = await supabase.from("quote_items").insert(quoteItemsRows)
  if (quoteItemsInsert.error) return { error: "Falha ao salvar itens do orçamento." }

  const paymentTerms =
    paymentPlan === "pix"
      ? { pix_discount_pct: config.discounts.pix_discount_pct }
      : paymentPlan === "deposit"
        ? { deposit_pct: config.discounts.deposit_pct }
        : { max_installments: config.discounts.max_installments }

  const reservationInsert = await supabase
    .from("reservations")
    .insert({
      user_id: user.id,
      quote_id: quoteId,
      status: "submitted",
      event_name: eventName,
      venue_name: venueName,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      postal_code: postalCode,
      notes,
      payment_plan: paymentPlan,
      payment_terms: paymentTerms,
      total_cents: breakdown.total_cents
    })
    .select("id")
    .single()

  if (reservationInsert.error) return { error: "Falha ao enviar solicitação de reserva." }

  redirect(`/cliente/pedidos/${reservationInsert.data.id}`)
}
