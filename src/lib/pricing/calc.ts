import type {
  EquipmentPrice,
  PaymentPlanType,
  PricingConfig,
  QuoteBreakdown,
  QuoteItemInput
} from "@/lib/domain/types"

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function clampPct(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, Math.trunc(value)))
}

function calcBundleDiscountCents(params: {
  items: QuoteItemInput[]
  pricingProfile: "hourly" | "daily" | "day_block"
  durationHours: number
  daysCount: number
  distanceKm: number
  priceByEquipmentId: Record<string, EquipmentPrice>
}) {
  const distance = Math.max(0, Number(params.distanceKm) || 0)
  if (distance > 30) return 0
  const eligibleItems = params.items.filter((i) => clampInt(i.quantity, 0, 999) > 0)
  const totalQty = eligibleItems.reduce((acc, i) => acc + clampInt(i.quantity, 0, 999), 0)
  if (totalQty < 2) return 0

  const tier = totalQty >= 3 ? "3" : "2"
  const baseHoursPerDay = 8
  const duration = clampInt(params.durationHours, 1, 24 * 7)
  const days = clampInt(params.daysCount, 1, 366)

  return eligibleItems.reduce((acc, item) => {
    const price = params.priceByEquipmentId[item.equipmentId]
    if (!price) return acc
    const qty = clampInt(item.quantity, 0, 999)
    if (qty === 0) return acc

    const lineBase =
      params.pricingProfile === "hourly"
        ? (() => {
            const billableHours = Math.max(duration, price.min_hours)
            return price.price_per_hour_cents * billableHours * qty
          })()
        : (() => {
            const dayCents =
              params.pricingProfile === "day_block"
                ? price.price_per_day_block_cents ?? price.price_per_day_cents
                : price.price_per_day_cents
            const effectiveDayCents =
              typeof dayCents === "number" && Number.isFinite(dayCents) && dayCents >= 0
                ? Math.trunc(dayCents)
                : price.price_per_hour_cents * baseHoursPerDay
            return effectiveDayCents * days * qty
          })()

    const pct =
      tier === "3"
        ? clampPct(price.discount_3_items_pct ?? NaN, 25)
        : clampPct(price.discount_2_items_pct ?? NaN, 15)

    const discount = Math.round((lineBase * pct) / 100)
    return acc + Math.max(0, Math.min(discount, lineBase))
  }, 0)
}

export function calcSubtotalCents(params: {
  items: QuoteItemInput[]
  durationHours: number
  pricingProfile?: "hourly" | "daily" | "day_block"
  daysCount?: number
  priceByEquipmentId: Record<string, EquipmentPrice>
}) {
  const duration = clampInt(params.durationHours, 1, 24 * 7)
  const days = clampInt(params.daysCount ?? 1, 1, 366)
  const baseHoursPerDay = 8

  return params.items.reduce((acc, item) => {
    const price = params.priceByEquipmentId[item.equipmentId]
    if (!price) return acc
    const qty = clampInt(item.quantity, 0, 999)
    if (qty === 0) return acc
    const profile = params.pricingProfile ?? "hourly"
    if (profile === "daily" || profile === "day_block") {
      const dayCents =
        profile === "day_block"
          ? price.price_per_day_block_cents ?? price.price_per_day_cents
          : price.price_per_day_cents
      const effectiveDayCents =
        typeof dayCents === "number" && Number.isFinite(dayCents) && dayCents >= 0
          ? Math.trunc(dayCents)
          : price.price_per_hour_cents * baseHoursPerDay
      return acc + effectiveDayCents * days * qty
    }

    const billableHours = Math.max(duration, price.min_hours)
    return acc + price.price_per_hour_cents * billableHours * qty
  }, 0)
}

export function calcDisplacementCents(params: {
  distanceKm: number
  config: PricingConfig["displacement"]
}) {
  const distance = Math.max(0, Number(params.distanceKm) || 0)
  const billableKm = Math.max(0, distance - params.config.free_km)
  return (
    params.config.base_fee_cents + Math.round(billableKm * params.config.per_km_cents)
  )
}

export function calcDiscountCents(params: {
  paymentPlan: PaymentPlanType
  subtotalPlusDisplacementCents: number
  discounts: PricingConfig["discounts"]
}) {
  if (params.paymentPlan !== "pix") return 0
  const pct = Math.max(0, Math.min(100, params.discounts.pix_discount_pct))
  return Math.round((params.subtotalPlusDisplacementCents * pct) / 100)
}

export function calcQuoteBreakdown(params: {
  items: QuoteItemInput[]
  durationHours: number
  distanceKm: number
  paymentPlan: PaymentPlanType
  pricingProfile?: "hourly" | "daily" | "day_block"
  daysCount?: number
  priceByEquipmentId: Record<string, EquipmentPrice>
  config: PricingConfig
}): QuoteBreakdown {
  const pricingProfile = params.pricingProfile ?? "hourly"
  const daysCount = clampInt(params.daysCount ?? 1, 1, 366)
  const subtotal = calcSubtotalCents({
    items: params.items,
    durationHours: params.durationHours,
    pricingProfile,
    daysCount,
    priceByEquipmentId: params.priceByEquipmentId
  })
  const displacement = calcDisplacementCents({
    distanceKm: params.distanceKm,
    config: params.config.displacement
  })
  const bundleDiscount = calcBundleDiscountCents({
    items: params.items,
    pricingProfile,
    durationHours: params.durationHours,
    daysCount,
    distanceKm: params.distanceKm,
    priceByEquipmentId: params.priceByEquipmentId
  })
  const prePix = Math.max(0, subtotal - bundleDiscount) + displacement
  const pixDiscount = calcDiscountCents({
    paymentPlan: params.paymentPlan,
    subtotalPlusDisplacementCents: prePix,
    discounts: params.config.discounts
  })
  const discount = Math.min(bundleDiscount + pixDiscount, prePix)
  return {
    subtotal_cents: subtotal,
    displacement_cents: displacement,
    discount_cents: discount,
    total_cents: Math.max(0, prePix - pixDiscount)
  }
}

export function formatBRLFromCents(cents: number) {
  const value = (Number.isFinite(cents) ? cents : 0) / 100
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
