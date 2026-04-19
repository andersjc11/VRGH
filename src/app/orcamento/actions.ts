"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import type { PaymentPlanType, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown } from "@/lib/pricing/calc"

export type CreateReservationState = {
  error?: string
}

function isMissingColumnError(err: unknown, column: string) {
  const message = (err as any)?.message
  if (typeof message !== "string") return false
  return message.toLowerCase().includes(`column "${column.toLowerCase()}" does not exist`)
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

export async function getEquipmentAvailability(params: {
  eventDaysMode: "single" | "multi" | ""
  eventDate: string
  eventEndDate: string
  startTime: string
  setupDate: string
  setupTime: string
  durationHours: number
  distanceKm: number
}) {
  const eventDaysMode =
    params?.eventDaysMode === "single" || params?.eventDaysMode === "multi"
      ? params.eventDaysMode
      : ""
  const eventDate = typeof params?.eventDate === "string" ? params.eventDate.trim() : ""
  const eventEndDate = typeof params?.eventEndDate === "string" ? params.eventEndDate.trim() : ""
  const startTime = typeof params?.startTime === "string" ? params.startTime.trim() : ""
  const setupDate = typeof params?.setupDate === "string" ? params.setupDate.trim() : ""
  const setupTime = typeof params?.setupTime === "string" ? params.setupTime.trim() : ""
  const durationHours = Number.isFinite(params?.durationHours) ? Math.trunc(params.durationHours) : 0
  const distanceKm = Number.isFinite(params?.distanceKm) ? Number(params.distanceKm) : 0

  const isMultiDay = eventDaysMode === "multi"
  const isReady = isMultiDay
    ? Boolean(eventDate && startTime && eventEndDate && setupDate && setupTime && durationHours > 0)
    : Boolean(eventDate && startTime && durationHours > 0)

  if (!isReady) {
    return { availabilityByEquipmentId: {} as Record<string, { total: number; reserved: number; available: number }>, error: null as string | null }
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_equipment_availability_v2", {
    event_date: eventDate,
    start_time: startTime,
    duration_hours: durationHours,
    distance_km: distanceKm,
    is_multi_day: isMultiDay,
    event_end_date: eventEndDate || null,
    setup_date: setupDate || null,
    setup_time: setupTime || null
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("get_equipment_availability_v2") && msg.includes("does not exist")) {
      return {
        availabilityByEquipmentId: {} as Record<
          string,
          { total: number; reserved: number; available: number }
        >,
        error:
          "Disponibilidade ainda não está configurada no banco. Execute as migrations 0014_equipments_inventory_and_availability.sql e 0015_multi_day_quotes_and_availability.sql no Supabase."
      }
    }
    return { availabilityByEquipmentId: {} as Record<string, { total: number; reserved: number; available: number }>, error: error.message }
  }

  const rows = (data ?? []) as any[]
  const availabilityByEquipmentId = Object.fromEntries(
    rows
      .filter((r) => typeof r?.equipment_id === "string")
      .map((r) => [
        r.equipment_id,
        {
          total: typeof r?.total_qty === "number" ? r.total_qty : 1,
          reserved: typeof r?.reserved_qty === "number" ? r.reserved_qty : 0,
          available: typeof r?.available_qty === "number" ? r.available_qty : 0
        }
      ])
  ) as Record<string, { total: number; reserved: number; available: number }>

  return { availabilityByEquipmentId, error: null as string | null }
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

function normalizeCondoCode(value: string) {
  return value.trim().toUpperCase()
}

function readCondoDiscountPct(valueJson: any, condoCode: string) {
  if (!condoCode) return 0
  const list = Array.isArray(valueJson) ? valueJson : Array.isArray(valueJson?.items) ? valueJson.items : []
  for (const row of list) {
    const code = normalizeCondoCode(typeof row?.code === "string" ? row.code : "")
    const active = row?.active
    const pct = Number(row?.discount_pct)
    if (code && code === condoCode && active !== false) {
      if (Number.isFinite(pct) && pct > 0) return Math.max(0, Math.min(100, Math.trunc(pct)))
      return 0
    }
  }
  return 0
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

function createSupabaseAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  })
}

function formatDateBR(value: string | null) {
  if (!value) return "—"
  const [y, m, d] = value.split("-")
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function formatBRLFromCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format((Number.isFinite(cents) ? cents : 0) / 100)
}

function paymentPlanLabel(plan: PaymentPlanType) {
  if (plan === "pix") return "Pix"
  if (plan === "deposit") return "Sinal + saldo"
  if (plan === "installments") return "Parcelado"
  return plan
}

async function sendReservationWhatsAppNotification(params: {
  reservationId: string
  quoteId: string
  userEmail: string
  clientName: string
  clientWhatsapp: string
  eventName: string
  eventDate: string | null
  startTime: string | null
  isMultiDay: boolean
  eventEndDate: string | null
  setupDate: string | null
  setupTime: string | null
  venueName: string
  addressLine1: string
  addressNumber: string
  addressLine2: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
  distanceKm: number
  daysCount: number
  durationHours: number
  paymentPlan: PaymentPlanType
  subtotalCents: number
  displacementCents: number
  discountCents: number
  totalCents: number
  notes: string
  items: QuoteItemInput[]
  equipmentNameById: Record<string, string>
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!token || !phoneNumberId) return

  const destinationNumber = "5512991568840"
  const itemsText =
    params.items.length > 0
      ? params.items
          .map((i) => `- ${i.quantity}x ${params.equipmentNameById[i.equipmentId] ?? i.equipmentId}`)
          .join("\n")
      : "- (sem itens)"

  const address = [
    `${params.addressLine1}, ${params.addressNumber}`,
    params.addressLine2,
    params.neighborhood,
    `${params.city}-${params.state}`,
    params.postalCode
  ]
    .filter(Boolean)
    .join(", ")

  const messageLines = [
    "Nova solicitação de reserva",
    "",
    `Reserva: ${params.reservationId}`,
    `Orçamento: ${params.quoteId}`,
    "",
    "Cliente:",
    `- Nome: ${params.clientName || "—"}`,
    `- WhatsApp: ${params.clientWhatsapp || "—"}`,
    `- E-mail: ${params.userEmail || "—"}`,
    "",
    "Evento:",
    `- Nome: ${params.eventName || "—"}`,
    `- Data: ${formatDateBR(params.eventDate)}`,
    `- Hora início: ${params.startTime || "—"}`,
    `- Duração: ${params.durationHours}h`,
    `- Distância: ${params.distanceKm.toFixed(2)} km`,
    `- Modalidade: ${params.isMultiDay ? `${params.daysCount} dias` : "1 dia"}`,
    params.isMultiDay ? `- Data final: ${formatDateBR(params.eventEndDate)}` : "",
    params.isMultiDay ? `- Montagem: ${formatDateBR(params.setupDate)} ${params.setupTime || ""}`.trim() : "",
    "",
    "Local:",
    `- ${params.venueName || "—"}`,
    `- ${address || "—"}`,
    "",
    "Itens:",
    itemsText,
    "",
    "Pagamento e valores:",
    `- Forma: ${paymentPlanLabel(params.paymentPlan)}`,
    `- Subtotal: ${formatBRLFromCents(params.subtotalCents)}`,
    `- Deslocamento: ${formatBRLFromCents(params.displacementCents)}`,
    `- Desconto: ${formatBRLFromCents(params.discountCents)}`,
    `- Total: ${formatBRLFromCents(params.totalCents)}`,
    "",
    `Observações: ${params.notes || "—"}`
  ].filter(Boolean)

  const text = messageLines.join("\n").slice(0, 3900)
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destinationNumber,
      type: "text",
      text: {
        body: text,
        preview_url: false
      }
    })
  })

  if (!res.ok) {
    const responseText = await res.text()
    throw new Error(`Falha ao enviar WhatsApp: ${responseText}`)
  }
}

export async function createReservation(
  _prevState: CreateReservationState,
  formData: FormData
): Promise<CreateReservationState> {
  const formRef = getString(formData, "ref").trim()
  const formCondoCode = normalizeCondoCode(getString(formData, "condo_code"))
  const supabase = createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) {
    const usp = new URLSearchParams()
    if (formRef) usp.set("ref", formRef)
    if (formCondoCode) usp.set("condo", formCondoCode)
    usp.set("restore", "1")
    const next = `/orcamento?${usp.toString()}`
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
    .select("full_name,cpf,address_line1,address_number,neighborhood,city,postal_code,whatsapp,phone,referred_by")
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRes.data as any
  const missingClientData =
    Boolean(profileRes.error) ||
    !profile?.full_name ||
    !profile?.cpf ||
    !profile?.address_line1 ||
    !profile?.address_number ||
    !profile?.neighborhood ||
    !profile?.city ||
    !profile?.postal_code ||
    !(profile?.whatsapp || profile?.phone)

  const itemsJson = getString(formData, "items_json")
  const items = parseItems(itemsJson)
  if (items.length === 0) return { error: "Selecione pelo menos 1 item." }

  let durationHours = getInt(formData, "duration_hours")
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
  const eventDaysMode = getString(formData, "event_days_mode")
  const rentalChargeModeRaw = getString(formData, "rental_charge_mode")
  const rentalChargeMode =
    rentalChargeModeRaw === "daily" || rentalChargeModeRaw === "hourly"
      ? rentalChargeModeRaw
      : "hourly"
  const eventDate = getString(formData, "event_date") || null
  const eventEndDate = getString(formData, "event_end_date") || null
  const startTime = getString(formData, "start_time") || null
  const setupDate = getString(formData, "setup_date") || null
  const setupTime = getString(formData, "setup_time") || null

  const destinationCep = normalizeCep(postalCode)
  const isMultiDay = eventDaysMode === "multi"
  if (!eventName) return { error: "Informe o nome do evento." }
  if (!eventDaysMode) return { error: "Selecione se o evento é de 1 dia ou mais dias." }
  if (!eventDate) return { error: isMultiDay ? "Informe a data de início do evento." : "Informe a data do evento." }
  if (!startTime) return { error: "Informe o horário de início do evento." }
  if (isMultiDay) {
    if (!eventEndDate) return { error: "Informe a data final do evento." }
    if (eventEndDate < eventDate) return { error: "A data final não pode ser anterior à data de início." }
    if (!setupDate) return { error: "Informe a data de montagem." }
    if (!setupTime) return { error: "Informe o horário de montagem." }
    if (setupDate > eventEndDate) return { error: "A data de montagem não pode ser após a data final do evento." }
  }
  if (!destinationCep) return { error: "Informe um CEP válido." }
  if (!addressNumber) return { error: "Informe o número do endereço." }

  const distanceFromForm = Math.max(0, getNumber(formData, "distance_km"))
  const distanceKm =
    destinationCep
      ? (await getDistanceKmFromGoogle({ originCep: "12305800", destinationCep: destinationCep }))
          .distanceKm ?? distanceFromForm
      : distanceFromForm

  if (distanceKm > 150) {
    return {
      error:
        "Para eventos fora da nossa localidade, o orçamento é personalizado. Chame no WhatsApp e solicite o seu: https://wa.me/5512991568840"
    }
  }

  const pricingProfile =
    distanceKm > 70
      ? ("day_block" as const)
      : isMultiDay || rentalChargeMode === "daily"
        ? ("daily" as const)
        : ("hourly" as const)

  if (pricingProfile === "hourly") {
    if (![4, 5, 6, 7, 8].includes(durationHours)) return { error: "Selecione uma duração entre 4 e 8 horas." }
  } else {
    durationHours = 8
  }

  const daysCount = (() => {
    if (!isMultiDay || !eventDate || !eventEndDate) return 1
    const start = new Date(`${eventDate}T00:00:00`)
    const end = new Date(`${eventEndDate}T00:00:00`)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 1
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    return Math.max(1, Math.min(366, diffDays))
  })()

  const availabilityRes = await supabase.rpc("get_equipment_availability_v2", {
    event_date: eventDate,
    start_time: startTime,
    duration_hours: durationHours,
    distance_km: distanceKm,
    is_multi_day: isMultiDay,
    event_end_date: eventEndDate,
    setup_date: setupDate,
    setup_time: setupTime
  })

  if (availabilityRes.error) {
    const msg = availabilityRes.error.message.toLowerCase()
    if (msg.includes("get_equipment_availability_v2") && msg.includes("does not exist")) {
      return {
        error:
          "Disponibilidade ainda não está configurada no banco. Execute as migrations 0014_equipments_inventory_and_availability.sql e 0015_multi_day_quotes_and_availability.sql no Supabase."
      }
    }
    return { error: `Falha ao checar disponibilidade: ${availabilityRes.error.message}` }
  }

  const availabilityRows = (availabilityRes.data ?? []) as any[]
  const availableByEquipmentId = Object.fromEntries(
    availabilityRows
      .filter((r) => typeof r?.equipment_id === "string")
      .map((r) => [
        r.equipment_id,
        typeof r?.available_qty === "number" ? r.available_qty : 0
      ])
  ) as Record<string, number>

  const equipmentIds = Array.from(new Set(items.map((i) => i.equipmentId)))
  const equipmentNamesRes = await supabase
    .from("equipments")
    .select("id,name")
    .in("id", equipmentIds)

  const equipmentNameById = Object.fromEntries(
    (equipmentNamesRes.data ?? [])
      .filter((r: any) => typeof r?.id === "string")
      .map((r: any) => [r.id, typeof r?.name === "string" ? r.name : r.id])
  ) as Record<string, string>

  const insufficient = items
    .map((i) => {
      const available = availableByEquipmentId[i.equipmentId] ?? 0
      return { ...i, available }
    })
    .filter((i) => i.quantity > i.available)

  if (insufficient.length > 0) {
    const details = insufficient
      .map((i) => {
        const name = equipmentNameById[i.equipmentId] ?? i.equipmentId
        return `${name}: solicitado ${i.quantity}, disponível ${i.available}`
      })
      .join(" • ")
    return { error: `Equipamentos indisponíveis para esse horário: ${details}` }
  }

  const pricesResWithProfiles = await supabase
    .from("equipment_prices")
    .select(
      "equipment_id,price_per_hour_cents,min_hours,price_per_day_cents,price_per_day_block_cents,discount_2_items_pct,discount_3_items_pct"
    )
    .in(
      "equipment_id",
      items.map((i) => i.equipmentId)
    )

  const pricesRes =
    pricesResWithProfiles.error &&
    (isMissingColumnError(pricesResWithProfiles.error, "price_per_day_cents") ||
      isMissingColumnError(pricesResWithProfiles.error, "discount_2_items_pct"))
      ? await supabase
          .from("equipment_prices")
          .select("equipment_id,price_per_hour_cents,min_hours")
          .in(
            "equipment_id",
            items.map((i) => i.equipmentId)
          )
      : pricesResWithProfiles

  const pricesData = pricesRes.data

  const priceByEquipmentId = Object.fromEntries(
    (pricesData ?? []).map((p: any) => [
      p.equipment_id,
      {
        equipment_id: p.equipment_id,
        price_per_hour_cents: p.price_per_hour_cents,
        min_hours: p.min_hours,
        price_per_day_cents: typeof p.price_per_day_cents === "number" ? p.price_per_day_cents : null,
        price_per_day_block_cents:
          typeof p.price_per_day_block_cents === "number" ? p.price_per_day_block_cents : null,
        discount_2_items_pct:
          typeof p.discount_2_items_pct === "number" ? p.discount_2_items_pct : null,
        discount_3_items_pct:
          typeof p.discount_3_items_pct === "number" ? p.discount_3_items_pct : null
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

  const { data: condominiumsSetting } = await supabase
    .from("pricing_settings")
    .select("value_json")
    .eq("key", "condominiums")
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

  const condoDiscountPct = readCondoDiscountPct(condominiumsSetting?.value_json, formCondoCode)

  const breakdown = calcQuoteBreakdown({
    items,
    durationHours,
    distanceKm,
    paymentPlan,
    condoDiscountPct,
    pricingProfile,
    daysCount,
    priceByEquipmentId,
    config
  })

  const quoteInsert = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      event_date: eventDate,
      is_multi_day: isMultiDay,
      event_end_date: isMultiDay ? eventEndDate : null,
      setup_date: isMultiDay ? setupDate : null,
      setup_time: isMultiDay ? setupTime : null,
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
    const baseHoursPerDay = 8
    const dayCents =
      pricingProfile === "day_block"
        ? price?.price_per_day_block_cents ?? price?.price_per_day_cents
        : pricingProfile === "daily"
          ? price?.price_per_day_cents
          : null
    const effectiveDayCents =
      typeof dayCents === "number" && Number.isFinite(dayCents) && dayCents >= 0
        ? Math.trunc(dayCents)
        : (price?.price_per_hour_cents ?? 0) * baseHoursPerDay
    const billableHours = Math.max(durationHours, price?.min_hours ?? 1)
    const unit = pricingProfile === "hourly" ? (price?.price_per_hour_cents ?? 0) : effectiveDayCents
    const lineTotal =
      pricingProfile === "hourly"
        ? unit * billableHours * i.quantity
        : unit * daysCount * i.quantity
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
      ? {}
      : paymentPlan === "deposit"
        ? { deposit_pct: config.discounts.deposit_pct }
        : { max_installments: config.discounts.max_installments }

  const paymentTermsWithRef = refCode ? { ...paymentTerms, ref: refCode } : paymentTerms
  const paymentTermsFinal = formCondoCode
    ? { ...paymentTermsWithRef, condo: formCondoCode, condo_discount_pct: condoDiscountPct }
    : paymentTermsWithRef

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
      payment_terms: paymentTermsFinal,
      total_cents: breakdown.total_cents
    })
    .select("id")
    .single()

  if (reservationInsert.error) return { error: "Falha ao enviar solicitação de reserva." }

  const reservationId = reservationInsert.data.id as string
  try {
    await sendReservationWhatsAppNotification({
      reservationId,
      quoteId,
      userEmail: user.email ?? "",
      clientName: typeof profile?.full_name === "string" ? profile.full_name : "",
      clientWhatsapp:
        (typeof profile?.whatsapp === "string" && profile.whatsapp) ||
        (typeof profile?.phone === "string" && profile.phone) ||
        "",
      eventName,
      eventDate,
      startTime,
      isMultiDay,
      eventEndDate: isMultiDay ? eventEndDate : null,
      setupDate: isMultiDay ? setupDate : null,
      setupTime: isMultiDay ? setupTime : null,
      venueName,
      addressLine1,
      addressNumber,
      addressLine2,
      neighborhood,
      city,
      state,
      postalCode,
      distanceKm,
      daysCount,
      durationHours,
      paymentPlan,
      subtotalCents: breakdown.subtotal_cents,
      displacementCents: breakdown.displacement_cents,
      discountCents: breakdown.discount_cents,
      totalCents: breakdown.total_cents,
      notes,
      items,
      equipmentNameById
    })
  } catch (err) {
    console.error("[createReservation] WhatsApp notification failed:", err)
  }

  try {
    const profileRow = profileRes.data as any
    const referredById = typeof profileRow?.referred_by === "string" ? profileRow.referred_by : ""

    const admin = createSupabaseAdminClient()
    const refCodeUpper = typeof refCode === "string" ? refCode.trim().toUpperCase() : ""

    let referrerId = referredById
    if (!referrerId && refCodeUpper) {
      const referrerRes = await admin.from("profiles").select("id").eq("referral_code", refCodeUpper).maybeSingle()
      referrerId = typeof (referrerRes.data as any)?.id === "string" ? (referrerRes.data as any).id : ""
    }

    if (referrerId && referrerId !== user.id) {
      await admin.from("referrals").upsert(
        {
          referrer_id: referrerId,
          referred_id: user.id,
          condominium_id: null,
          reservation_id: reservationId,
          cashback_cents: Math.floor(breakdown.total_cents * 0.05),
          status: "pending"
        },
        { onConflict: "referred_id,reservation_id" }
      )
    }
  } catch {}

  if (missingClientData) {
    redirect(`/cliente/dados?next=${encodeURIComponent(`/cliente/pedidos/${reservationId}`)}`)
  }
  redirect(`/cliente/pedidos/${reservationId}`)
}
