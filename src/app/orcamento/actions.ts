"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { PaymentPlanType, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown } from "@/lib/pricing/calc"

export type CreateReservationState = {
  error?: string
}

function normalizeCep(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length === 8 ? digits : ""
}

function formatCep(value: string) {
  const digits = normalizeCep(value)
  if (!digits) return ""
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

async function getCepContext(cep: string) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: "no-store" })
    if (!res.ok) return null
    const json = (await res.json()) as any
    if (json?.erro) return null
    const city = typeof json?.localidade === "string" ? json.localidade : ""
    const uf = typeof json?.uf === "string" ? json.uf : ""
    return city && uf ? { city, uf } : null
  } catch {
    return null
  }
}

function buildBrazilLocationQuery(params: { cep: string; city?: string; uf?: string }) {
  const formatted = formatCep(params.cep) || params.cep
  const parts = [formatted]
  if (params.city && params.uf) parts.push(`${params.city}-${params.uf}`)
  parts.push("Brasil")
  return parts.join(", ")
}

async function fetchDistanceMatrixMeters(params: { origins: string; destinations: string; key: string }) {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
  url.searchParams.set("origins", params.origins)
  url.searchParams.set("destinations", params.destinations)
  url.searchParams.set("mode", "driving")
  url.searchParams.set("language", "pt-BR")
  url.searchParams.set("region", "br")
  url.searchParams.set("key", params.key)

  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) return { meters: null as number | null, status: "HTTP_ERROR" }

  const json = (await res.json()) as any
  const topStatus = typeof json?.status === "string" ? json.status : ""
  const element = json?.rows?.[0]?.elements?.[0]
  const elementStatus = typeof element?.status === "string" ? element.status : ""
  const meters = element?.distance?.value

  if (topStatus && topStatus !== "OK") return { meters: null as number | null, status: topStatus }
  if (elementStatus && elementStatus !== "OK") return { meters: null as number | null, status: elementStatus }
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return { meters: null as number | null, status: "INVALID_RESPONSE" }

  return { meters, status: "OK" }
}

async function getDistanceKmFromGoogle(params: { originCep: string; destinationCep: string }) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return { distanceKm: null as number | null, error: "GOOGLE_MAPS_API_KEY não configurada." }

  const origin = normalizeCep(params.originCep)
  const destination = normalizeCep(params.destinationCep)
  if (!origin || !destination) {
    return { distanceKm: null as number | null, error: "CEP inválido para cálculo de distância." }
  }

  const [originCtx, destCtx] = await Promise.all([getCepContext(origin), getCepContext(destination)])
  const originsWithContext = buildBrazilLocationQuery({ cep: origin, city: originCtx?.city, uf: originCtx?.uf })
  const destWithContext = buildBrazilLocationQuery({ cep: destination, city: destCtx?.city, uf: destCtx?.uf })

  const firstTry = await fetchDistanceMatrixMeters({
    origins: originsWithContext,
    destinations: destWithContext,
    key
  })

  const retryStatuses = new Set(["NOT_FOUND", "INVALID_REQUEST", "MAX_ROUTE_LENGTH_EXCEEDED"])
  const shouldRetry = firstTry.meters === null && retryStatuses.has(firstTry.status)

  const secondTry = shouldRetry
    ? await fetchDistanceMatrixMeters({
        origins: buildBrazilLocationQuery({ cep: origin }),
        destinations: buildBrazilLocationQuery({ cep: destination }),
        key
      })
    : firstTry

  const meters = secondTry.meters
  if (meters === null) {
    return { distanceKm: null as number | null, error: `Google Maps: ${secondTry.status}` }
  }

  return { distanceKm: Math.round((meters / 1000) * 100) / 100, error: null as string | null }
}

export async function calcDistanceKmFromCep(destinationCep: string) {
  const originCep = "12305800"
  const { distanceKm, error } = await getDistanceKmFromGoogle({
    originCep,
    destinationCep
  })
  if (distanceKm === null) return { distanceKm: null as number | null, error: error ?? "Falha ao calcular distância." }
  return { distanceKm, error: null as string | null }
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
  const formRef = getString(formData, "ref").trim()
  const supabase = createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) {
    const next = formRef ? `/orcamento?ref=${encodeURIComponent(formRef)}` : "/orcamento"
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  const cookieRef = cookies().get("vrgh_ref")?.value?.trim()
  const metaRef = typeof (user as any)?.user_metadata?.ref === "string" ? (user as any).user_metadata.ref.trim() : ""
  const refCode = formRef || cookieRef || metaRef
  if (refCode) {
    const applyRes = await supabase.rpc("apply_referral_code", { ref_code: refCode })
    if (applyRes.error) {
      return { error: `Falha ao aplicar indicação: ${applyRes.error.message}` }
    }
  }

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

  const durationHours = getInt(formData, "duration_hours")
  const paymentPlan = getString(formData, "payment_plan") as PaymentPlanType

  const eventName = getString(formData, "event_name")
  const venueName = getString(formData, "venue_name")
  const addressLine1 = getString(formData, "address_line1")
  const addressNumber = getString(formData, "address_number")
  const addressLine2 = getString(formData, "address_line2")
  const neighborhood = getString(formData, "neighborhood")
  const city = getString(formData, "city")
  const state = getString(formData, "state")
  const postalCode = getString(formData, "postal_code")
  const notes = getString(formData, "notes")
  const eventDate = getString(formData, "event_date") || null
  const startTime = getString(formData, "start_time") || null

  const destinationCep = normalizeCep(postalCode)
  if (!eventName) return { error: "Informe o nome do evento." }
  if (!eventDate) return { error: "Informe a data do evento." }
  if (!startTime) return { error: "Informe o horário do evento." }
  if (!destinationCep) return { error: "Informe um CEP válido." }
  if (!addressNumber) return { error: "Informe o número do endereço." }
  if (![4, 5, 6, 7, 8].includes(durationHours)) return { error: "Selecione uma duração entre 4 e 8 horas." }

  const distanceFromForm = Math.max(0, getNumber(formData, "distance_km"))
  const distanceKm =
    destinationCep
      ? (await getDistanceKmFromGoogle({ originCep: "12305800", destinationCep: destinationCep }))
          .distanceKm ?? distanceFromForm
      : distanceFromForm

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

  const paymentTermsWithRef = refCode ? { ...paymentTerms, ref: refCode } : paymentTerms

  const reservationInsert = await supabase
    .from("reservations")
    .insert({
      user_id: user.id,
      quote_id: quoteId,
      status: "submitted",
      event_name: eventName,
      venue_name: venueName,
      address_line1: addressLine1,
      address_number: addressNumber,
      address_line2: addressLine2,
      neighborhood: neighborhood,
      city,
      state,
      postal_code: postalCode,
      notes,
      payment_plan: paymentPlan,
      payment_terms: paymentTermsWithRef,
      total_cents: breakdown.total_cents
    })
    .select("id")
    .single()

  if (reservationInsert.error) return { error: "Falha ao enviar solicitação de reserva." }

  redirect(`/cliente/pedidos/${reservationInsert.data.id}`)
}
