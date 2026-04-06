export type UserRole = "client" | "admin" | "sindico"

export type ReservationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "confirmed"
  | "cancelled"
  | "completed"

export type PaymentPlanType = "installments" | "deposit" | "pix"

export type CashbackStatus = "pending" | "approved" | "cancelled"

export type Equipment = {
  id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  active: boolean
}

export type EquipmentPrice = {
  equipment_id: string
  price_per_hour_cents: number
  min_hours: number
}

export type QuoteItemInput = {
  equipmentId: string
  quantity: number
}

export type PricingConfig = {
  displacement: {
    base_fee_cents: number
    free_km: number
    per_km_cents: number
  }
  discounts: {
    pix_discount_pct: number
    deposit_pct: number
    max_installments: number
  }
}

export type QuoteBreakdown = {
  subtotal_cents: number
  displacement_cents: number
  discount_cents: number
  total_cents: number
}

