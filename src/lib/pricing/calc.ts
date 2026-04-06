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

export function calcSubtotalCents(params: {
  items: QuoteItemInput[]
  durationHours: number
  priceByEquipmentId: Record<string, EquipmentPrice>
}) {
  const duration = clampInt(params.durationHours, 1, 24 * 7)

  return params.items.reduce((acc, item) => {
    const price = params.priceByEquipmentId[item.equipmentId]
    if (!price) return acc
    const qty = clampInt(item.quantity, 0, 999)
    if (qty === 0) return acc
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
  priceByEquipmentId: Record<string, EquipmentPrice>
  config: PricingConfig
}): QuoteBreakdown {
  const subtotal = calcSubtotalCents({
    items: params.items,
    durationHours: params.durationHours,
    priceByEquipmentId: params.priceByEquipmentId
  })
  const displacement = calcDisplacementCents({
    distanceKm: params.distanceKm,
    config: params.config.displacement
  })
  const preDiscount = subtotal + displacement
  const discount = calcDiscountCents({
    paymentPlan: params.paymentPlan,
    subtotalPlusDisplacementCents: preDiscount,
    discounts: params.config.discounts
  })
  return {
    subtotal_cents: subtotal,
    displacement_cents: displacement,
    discount_cents: discount,
    total_cents: Math.max(0, preDiscount - discount)
  }
}

export function formatBRLFromCents(cents: number) {
  const value = (Number.isFinite(cents) ? cents : 0) / 100
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

