"use client"

import * as React from "react"
import { useFormState, useFormStatus } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import type { Equipment, EquipmentPrice, PaymentPlanType, PricingConfig, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown, formatBRLFromCents } from "@/lib/pricing/calc"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { calcDistanceKmFromCep, createReservation, getEquipmentAvailability, type CreateReservationState } from "./actions"

type QuoteSessionV1 = {
  v: 1
  reserveMode?: boolean
  condoCode?: string
  durationHours: number
  distanceKm: number
  paymentPlan: PaymentPlanType
  qtyById: Record<string, string>
  eventDaysMode: "" | "single" | "multi"
  rentalChargeMode: "hourly" | "daily"
  eventDate: string
  eventEndDate: string
  startTime: string
  endTime: string
  setupDate: string
  setupTime: string
  postalCode: string
  addressLine1: string
  addressNumber: string
  addressLine2: string
  neighborhood: string
  city: string
  stateUf: string
  eventName: string
  venueName: string
  notes: string
}

type Props = {
  equipments: Equipment[]
  prices: EquipmentPrice[]
  config: PricingConfig
  refCode?: string
  condoCode?: string
  condoDiscountPct?: number
  isAuthenticated: boolean
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      Enviar solicitação de reserva
    </Button>
  )
}

export function OrcamentoForm({
  equipments,
  prices,
  config,
  refCode,
  condoCode,
  condoDiscountPct,
  isAuthenticated
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = React.useRef<HTMLFormElement | null>(null)
  const QUOTE_SESSION_KEY = "vrgh:quote_session_v1"
  const isRestoring = searchParams.get("restore") === "1"

  const priceByEquipmentId = React.useMemo(
    () =>
      Object.fromEntries(prices.map((p) => [p.equipment_id, p])) as Record<
        string,
        EquipmentPrice
      >,
    [prices]
  )

  const [durationHours, setDurationHours] = React.useState(4)
  const [distanceKm, setDistanceKm] = React.useState(10)
  const [paymentPlan, setPaymentPlan] = React.useState<PaymentPlanType>("pix")
  const [qtyById, setQtyById] = React.useState<Record<string, string>>({})
  const [reserveMode, setReserveMode] = React.useState(false)
  const [eventDaysMode, setEventDaysMode] = React.useState<"" | "single" | "multi">("")
  const [rentalChargeMode, setRentalChargeMode] = React.useState<"hourly" | "daily">("hourly")
  const [eventDate, setEventDate] = React.useState("")
  const [eventEndDate, setEventEndDate] = React.useState("")
  const [startTime, setStartTime] = React.useState("")
  const [endTime, setEndTime] = React.useState("")
  const [setupDate, setSetupDate] = React.useState("")
  const [setupTime, setSetupTime] = React.useState("")
  const [postalCode, setPostalCode] = React.useState("")
  const [addressLine1, setAddressLine1] = React.useState("")
  const [addressNumber, setAddressNumber] = React.useState("")
  const [addressLine2, setAddressLine2] = React.useState("")
  const [neighborhood, setNeighborhood] = React.useState("")
  const [city, setCity] = React.useState("")
  const [stateUf, setStateUf] = React.useState("")
  const [eventName, setEventName] = React.useState("")
  const [venueName, setVenueName] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [distanceError, setDistanceError] = React.useState<string | null>(null)
  const [cepError, setCepError] = React.useState<string | null>(null)
  const [isDistancePending, startDistanceTransition] = React.useTransition()
  const [availabilityByEquipmentId, setAvailabilityByEquipmentId] = React.useState<
    Record<string, { total: number; reserved: number; available: number }>
  >({})
  const [availabilityError, setAvailabilityError] = React.useState<string | null>(null)
  const [isAvailabilityPending, startAvailabilityTransition] = React.useTransition()
  const cepAbortRef = React.useRef<AbortController | null>(null)

  function normalizeCep(value: string) {
    return value.replace(/\D/g, "").slice(0, 8)
  }

  async function fetchAddressByCep(cep: string) {
    cepAbortRef.current?.abort()
    const controller = new AbortController()
    cepAbortRef.current = controller
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal
    })
    if (!res.ok) throw new Error("Falha ao consultar CEP.")
    const json = (await res.json()) as any
    if (json?.erro) throw new Error("CEP não encontrado.")
    return {
      street: typeof json?.logradouro === "string" ? json.logradouro : "",
      neighborhood: typeof json?.bairro === "string" ? json.bairro : "",
      city: typeof json?.localidade === "string" ? json.localidade : "",
      uf: typeof json?.uf === "string" ? json.uf : ""
    }
  }

  const lockByCep = postalCode.length === 8 && !cepError
  const isTooFar = lockByCep && !isDistancePending && distanceKm > 150
  const whatsappUrl = React.useMemo(() => {
    const phone = "5512991568840"
    const distanceText = Number.isFinite(distanceKm) ? `${Math.round(distanceKm)}km` : ""
    const text = encodeURIComponent(
      `Olá! Preciso de um orçamento personalizado. CEP do evento: ${postalCode}. Distância aproximada: ${distanceText}.`
    )
    return `https://wa.me/${phone}?text=${text}`
  }, [postalCode, distanceKm])

  const items: QuoteItemInput[] = React.useMemo(
    () =>
      Object.entries(qtyById)
        .map(([equipmentId, quantity]) => ({
          equipmentId,
          quantity: Number(quantity) || 0
        }))
        .filter((x) => x.quantity > 0),
    [qtyById]
  )

  const daysCount = React.useMemo(() => {
    if (eventDaysMode !== "multi") return 1
    if (!eventDate || !eventEndDate) return 1
    const start = new Date(`${eventDate}T00:00:00`)
    const end = new Date(`${eventEndDate}T00:00:00`)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 1
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    return Math.max(1, Math.min(366, diffDays))
  }, [eventDaysMode, eventDate, eventEndDate])

  const pricingProfile = React.useMemo(() => {
    if (distanceKm > 70) return "day_block" as const
    if (eventDaysMode === "multi") return "daily" as const
    if (eventDaysMode === "single" && rentalChargeMode === "daily") return "daily" as const
    return "hourly" as const
  }, [distanceKm, eventDaysMode, rentalChargeMode])

  const needsEndTime = eventDaysMode === "single" && pricingProfile === "hourly"
  const singleDurationHours = React.useMemo(() => {
    if (!needsEndTime) return null
    if (!startTime || !endTime) return null
    const [sh, sm] = startTime.split(":").map((x) => Number(x))
    const [eh, em] = endTime.split(":").map((x) => Number(x))
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return null
    const startMinutes = sh * 60 + sm
    const endMinutes = eh * 60 + em
    const diffMinutes = endMinutes - startMinutes
    if (diffMinutes <= 0) return null
    return Math.ceil(diffMinutes / 60)
  }, [endTime, needsEndTime, startTime])

  const singleDurationError = React.useMemo(() => {
    if (!needsEndTime) return null
    if (!startTime || !endTime) return null
    const [sh, sm] = startTime.split(":").map((x) => Number(x))
    const [eh, em] = endTime.split(":").map((x) => Number(x))
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) {
      return "Informe um horário válido."
    }
    const startMinutes = sh * 60 + sm
    const endMinutes = eh * 60 + em
    if (endMinutes <= startMinutes) return "O horário de término deve ser após o início."
    const hours = Math.ceil((endMinutes - startMinutes) / 60)
    if (hours < 4 || hours > 8) return "A locação por hora deve ter entre 4 e 8 horas."
    return null
  }, [endTime, needsEndTime, startTime])

  const effectiveDurationHours = React.useMemo(() => {
    if (pricingProfile !== "hourly") return 8
    if (eventDaysMode === "single" && needsEndTime) return singleDurationHours ?? durationHours
    return durationHours
  }, [durationHours, eventDaysMode, needsEndTime, pricingProfile, singleDurationHours])

  const isEventReady = React.useMemo(() => {
    if (eventDaysMode === "single") {
      if (!eventDate || !startTime) return false
      if (needsEndTime) {
        if (!endTime) return false
        if (!singleDurationHours) return false
        if (singleDurationHours < 4 || singleDurationHours > 8) return false
      }
      return true
    }
    if (eventDaysMode === "multi") {
      return Boolean(eventDate && startTime && eventEndDate && setupDate && setupTime)
    }
    return false
  }, [endTime, eventDate, eventDaysMode, eventEndDate, needsEndTime, setupDate, setupTime, singleDurationHours, startTime])

  const itemsForPricing = isEventReady ? items : []

  const breakdown = React.useMemo(
    () =>
      calcQuoteBreakdown({
        items: itemsForPricing,
        durationHours: effectiveDurationHours,
        distanceKm,
        paymentPlan,
        condoDiscountPct,
        pricingProfile,
        daysCount,
        priceByEquipmentId,
        config
      }),
    [
      config,
      daysCount,
      distanceKm,
      effectiveDurationHours,
      itemsForPricing,
      paymentPlan,
      condoDiscountPct,
      priceByEquipmentId,
      pricingProfile
    ]
  )

  const summary = React.useMemo(() => {
    const equipmentNameById = Object.fromEntries(equipments.map((e) => [e.id, e.name]))
    const baseLines = itemsForPricing
      .map((item) => {
        const price = priceByEquipmentId[item.equipmentId]
        if (!price) return null
        const qty = Math.max(0, Math.trunc(Number(item.quantity) || 0))
        if (qty === 0) return null

        const baseCents =
          pricingProfile === "hourly"
            ? (() => {
                const billableHours = Math.max(Math.trunc(effectiveDurationHours), price.min_hours)
                return price.price_per_hour_cents * billableHours * qty
              })()
            : (() => {
                const baseHoursPerDay = 8
                const dayCents =
                  pricingProfile === "day_block"
                    ? price.price_per_day_block_cents ?? price.price_per_day_cents
                    : price.price_per_day_cents
                const effectiveDayCents =
                  typeof dayCents === "number" && Number.isFinite(dayCents) && dayCents >= 0
                    ? Math.trunc(dayCents)
                    : price.price_per_hour_cents * baseHoursPerDay
                return effectiveDayCents * Math.max(1, Math.trunc(daysCount)) * qty
              })()

        return {
          equipmentId: item.equipmentId,
          name: (equipmentNameById[item.equipmentId] as string | undefined) ?? item.equipmentId,
          quantity: qty,
          base_cents: Math.max(0, Math.trunc(baseCents))
        }
      })
      .filter(Boolean) as Array<{ equipmentId: string; name: string; quantity: number; base_cents: number }>

    const totalBase = baseLines.reduce((acc, l) => acc + l.base_cents, 0)
    const displacement = Math.max(0, Math.trunc(breakdown.displacement_cents))

    if (baseLines.length === 0 || totalBase <= 0) {
      return {
        lines: [],
        discount_cents: Math.max(0, Math.trunc(breakdown.discount_cents)),
        total_cents: Math.max(0, Math.trunc(breakdown.total_cents))
      }
    }

    const shares = baseLines.map((l, idx) => {
      const raw = (displacement * l.base_cents) / totalBase
      const floored = Math.floor(raw)
      return { idx, floored, remainder: raw - floored }
    })
    const flooredByIdx = shares.reduce((acc, s) => {
      acc[s.idx] = s.floored
      return acc
    }, new Array<number>(baseLines.length).fill(0))
    const flooredSum = shares.reduce((acc, s) => acc + s.floored, 0)
    let remaining = Math.max(0, displacement - flooredSum)

    shares.sort((a, b) => b.remainder - a.remainder)
    const extraByIdx = new Array(baseLines.length).fill(0)
    for (let i = 0; i < shares.length && remaining > 0; i += 1) {
      extraByIdx[shares[i].idx] += 1
      remaining -= 1
    }

    const lines = baseLines.map((l, idx) => ({
      ...l,
      total_cents: l.base_cents + flooredByIdx[idx] + extraByIdx[idx]
    }))

    return {
      lines,
      discount_cents: Math.max(0, Math.trunc(breakdown.discount_cents)),
      total_cents: Math.max(0, Math.trunc(breakdown.total_cents))
    }
  }, [
    breakdown.discount_cents,
    breakdown.displacement_cents,
    breakdown.total_cents,
    daysCount,
    effectiveDurationHours,
    equipments,
    itemsForPricing,
    priceByEquipmentId,
    pricingProfile
  ])

  const [state, action] = useFormState(createReservation, {} as CreateReservationState)

  const snapshotSession = React.useCallback((nextReserveMode?: boolean) => {
    const payload: QuoteSessionV1 = {
      v: 1,
      reserveMode: typeof nextReserveMode === "boolean" ? nextReserveMode : reserveMode,
      condoCode,
      durationHours,
      distanceKm,
      paymentPlan,
      qtyById,
      eventDaysMode,
      rentalChargeMode,
      eventDate,
      eventEndDate,
      startTime,
      endTime,
      setupDate,
      setupTime,
      postalCode,
      addressLine1,
      addressNumber,
      addressLine2,
      neighborhood,
      city,
      stateUf,
      eventName,
      venueName,
      notes
    }

    try {
      sessionStorage.setItem(QUOTE_SESSION_KEY, JSON.stringify(payload))
    } catch {
    }
  }, [
    QUOTE_SESSION_KEY,
    addressLine1,
    addressLine2,
    addressNumber,
    city,
    distanceKm,
    durationHours,
    endTime,
    eventDate,
    eventDaysMode,
    eventEndDate,
    eventName,
    neighborhood,
    notes,
    paymentPlan,
    postalCode,
    qtyById,
    rentalChargeMode,
    setupDate,
    setupTime,
    reserveMode,
    startTime,
    stateUf,
    venueName,
    condoCode
  ])

  const nextAfterAuth = React.useMemo(() => {
    const usp = new URLSearchParams()
    if (refCode) usp.set("ref", refCode)
    if (condoCode) usp.set("condo", condoCode)
    usp.set("restore", "1")
    return `/orcamento?${usp.toString()}`
  }, [condoCode, refCode])

  const loginHref = React.useMemo(() => `/login?next=${encodeURIComponent(nextAfterAuth)}`, [nextAfterAuth])
  const cadastroHref = React.useMemo(() => `/cadastro?next=${encodeURIComponent(nextAfterAuth)}`, [nextAfterAuth])

  React.useEffect(() => {
    const shouldRestore = searchParams.get("restore") === "1"
    if (!shouldRestore) return

    try {
      const raw = sessionStorage.getItem(QUOTE_SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as QuoteSessionV1
      if (!parsed || parsed.v !== 1) return

      setReserveMode(Boolean(parsed.reserveMode))
      setDurationHours(parsed.durationHours)
      setDistanceKm(parsed.distanceKm)
      setPaymentPlan(parsed.paymentPlan)
      setQtyById(parsed.qtyById ?? {})
      setEventDaysMode(parsed.eventDaysMode)
      setRentalChargeMode(parsed.rentalChargeMode)
      setEventDate(parsed.eventDate)
      setEventEndDate(parsed.eventEndDate)
      setStartTime(parsed.startTime)
      setEndTime(parsed.endTime ?? "")
      setSetupDate(parsed.setupDate)
      setSetupTime(parsed.setupTime)
      setPostalCode(parsed.postalCode)
      setAddressLine1(parsed.addressLine1)
      setAddressNumber(parsed.addressNumber)
      setAddressLine2(parsed.addressLine2)
      setNeighborhood(parsed.neighborhood)
      setCity(parsed.city)
      setStateUf(parsed.stateUf)
      setEventName(parsed.eventName)
      setVenueName(parsed.venueName)
      setNotes(parsed.notes)
    } catch {
    } finally {
      try {
        sessionStorage.removeItem(QUOTE_SESSION_KEY)
      } catch {
      }
      const usp = new URLSearchParams(searchParams.toString())
      usp.delete("restore")
      router.replace(usp.toString() ? `/orcamento?${usp.toString()}` : "/orcamento")
    }
  }, [QUOTE_SESSION_KEY, router, searchParams])

  React.useEffect(() => {
    if (!isEventReady) {
      setAvailabilityByEquipmentId({})
      setAvailabilityError(null)
      return
    }

    startAvailabilityTransition(async () => {
      const res = await getEquipmentAvailability({
        eventDaysMode,
        eventDate,
        eventEndDate,
        startTime,
        setupDate,
        setupTime,
        durationHours: effectiveDurationHours,
        distanceKm
      })
      if (res.error) {
        setAvailabilityByEquipmentId({})
        setAvailabilityError(res.error)
        return
      }
      setAvailabilityError(null)
      setAvailabilityByEquipmentId(res.availabilityByEquipmentId)
    })
  }, [
    distanceKm,
    effectiveDurationHours,
    eventDate,
    eventDaysMode,
    eventEndDate,
    isEventReady,
    setupDate,
    setupTime,
    startTime
  ])

  React.useEffect(() => {
    if (eventDaysMode !== "multi") {
      setEventEndDate("")
      setSetupDate("")
      setSetupTime("")
    }
  }, [eventDaysMode])

  React.useEffect(() => {
    if (isRestoring) return
    if (eventDaysMode !== "single" || !needsEndTime) setEndTime("")
  }, [eventDaysMode, isRestoring, needsEndTime])

  React.useEffect(() => {
    if (!eventDaysMode) {
      setRentalChargeMode("hourly")
      return
    }
    if (eventDaysMode === "multi") {
      setRentalChargeMode("daily")
      return
    }
  }, [eventDaysMode])

  React.useEffect(() => {
    if (pricingProfile !== "hourly") {
      setDurationHours(8)
    }
  }, [pricingProfile])

  React.useEffect(() => {
    if (!needsEndTime) return
    if (!singleDurationHours) return
    if (durationHours !== singleDurationHours) setDurationHours(singleDurationHours)
  }, [durationHours, needsEndTime, singleDurationHours])

  React.useEffect(() => {
    const hasAny = Object.keys(availabilityByEquipmentId).length > 0
    if (!hasAny) return
    setQtyById((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [equipmentId, raw] of Object.entries(next)) {
        const current = Number(raw)
        if (!Number.isFinite(current)) continue
        const max = availabilityByEquipmentId[equipmentId]?.available
        if (typeof max === "number" && current > max) {
          next[equipmentId] = String(Math.max(max, 0))
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [availabilityByEquipmentId])

  const hasAvailabilityData = Object.keys(availabilityByEquipmentId).length > 0

  const filteredEquipments =
    !isEventReady || !hasAvailabilityData
      ? []
      : equipments.filter((eq) => (availabilityByEquipmentId[eq.id]?.available ?? 0) > 0)

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (!isEventReady) {
          e.preventDefault()
          return
        }
        if (!isAuthenticated) {
          e.preventDefault()
          setReserveMode(true)
          snapshotSession(true)
          router.push(loginHref)
          return
        }
        if (!reserveMode) {
          e.preventDefault()
          setReserveMode(true)
        }
      }}
      className="mt-8 grid gap-6 lg:grid-cols-3"
    >
      <input type="hidden" name="ref" value={refCode ?? ""} />
      <input type="hidden" name="condo_code" value={condoCode ?? ""} />
      <input type="hidden" name="address_line1" value={addressLine1} />
      <input type="hidden" name="address_number" value={addressNumber} />
      <input type="hidden" name="address_line2" value={addressLine2} />
      <input type="hidden" name="neighborhood" value={neighborhood} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="state" value={stateUf} />
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <p className="text-sm text-zinc-400">1. Dados do evento</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">CEP do evento</label>
              <Input
                name="postal_code"
                value={postalCode}
                onChange={(e) => {
                  const next = normalizeCep(e.target.value)
                  setPostalCode(next)
                  setDistanceError(null)
                  setCepError(null)
                  if (next.length < 8) {
                    setAddressLine1("")
                    setNeighborhood("")
                    setCity("")
                    setStateUf("")
                    setAddressLine2("")
                    setDistanceKm(10)
                  }
                  if (next.length === 8) {
                    startDistanceTransition(async () => {
                      const res = await calcDistanceKmFromCep(next)
                      if (res.error) {
                        setDistanceError(res.error)
                        setDistanceKm(0)
                        return
                      }
                      if (typeof res.distanceKm === "number") {
                        setDistanceKm(res.distanceKm)
                        if (res.distanceKm > 150) setEventDaysMode("")
                      }
                    })
                    ;(async () => {
                      try {
                        const addr = await fetchAddressByCep(next)
                        setAddressLine1(addr.street || "")
                        setNeighborhood(addr.neighborhood || "")
                        setCity(addr.city || "")
                        setStateUf(addr.uf || "")
                      } catch (err) {
                        if ((err as any)?.name === "AbortError") return
                        setCepError(err instanceof Error ? err.message : "Falha ao buscar endereço.")
                      }
                    })()
                  }
                }}
                required
              />
              {cepError ? <p className="text-xs text-red-300">{cepError}</p> : null}
              <p className="text-xs text-zinc-400">
                {isDistancePending
                  ? "Calculando a distância pelo CEP..."
                  : distanceError
                    ? "Não foi possível calcular automaticamente. Informe a distância manualmente."
                    : lockByCep
                      ? "Distância calculada automaticamente pelo CEP."
                      : "Informe o CEP para continuar."}
              </p>
              {distanceError && lockByCep && !isDistancePending ? (
                <div className="mt-2 space-y-2">
                  <label className="text-sm text-zinc-200">Distância (km)</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    required
                  />
                  <p className="text-xs text-red-300">{distanceError}</p>
                </div>
              ) : null}
            </div>

            {isTooFar ? (
              <div className="sm:col-span-2">
                <p className="text-sm text-zinc-300">
                  Para eventos fora da nossa localidade, o orçamento é personalizado. Chame no WhatsApp e solicite o seu.
                </p>
                <div className="mt-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-500"
                  >
                    Falar no WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm text-zinc-200">Qual o período de locação?</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="radio"
                        name="event_days_mode"
                        value="single"
                        checked={eventDaysMode === "single"}
                        onChange={() => {
                          setEventDaysMode("single")
                          setEndTime("")
                        }}
                        required
                        disabled={!lockByCep || isDistancePending || Boolean(distanceError && distanceKm <= 0)}
                      />
                      1 dia/hora
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="radio"
                        name="event_days_mode"
                        value="multi"
                        checked={eventDaysMode === "multi"}
                        onChange={() => {
                          setEventDaysMode("multi")
                          setEndTime("")
                        }}
                        disabled={!lockByCep || isDistancePending || Boolean(distanceError && distanceKm <= 0)}
                      />
                      Mais de 1 dia
                    </label>
                  </div>
                </div>
              </>
            )}

            {eventDaysMode ? (
              <>
                {eventDaysMode === "single" ? (
                  <>
                    <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-200">Dia do evento</label>
                        <Input
                          name="event_date"
                          type="date"
                          required
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-200">Horário de início</label>
                        <Input
                          name="start_time"
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      {needsEndTime ? (
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200">Horário de término</label>
                          <Input
                            type="time"
                            required
                            value={endTime}
                            min={startTime || undefined}
                            onChange={(e) => setEndTime(e.target.value)}
                          />
                          {singleDurationHours ? (
                            <p className="text-xs text-zinc-400">Duração: {singleDurationHours}h</p>
                          ) : null}
                          {singleDurationError ? (
                            <p className="text-xs text-red-300">{singleDurationError}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-200">Data de início</label>
                      <Input
                        name="event_date"
                        type="date"
                        required
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-200">Horário de início</label>
                      <Input
                        name="start_time"
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-200">Data final</label>
                      <Input
                        name="event_end_date"
                        type="date"
                        required
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        min={eventDate || undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-200">Data de montagem</label>
                      <Input
                        name="setup_date"
                        type="date"
                        required
                        value={setupDate}
                        onChange={(e) => setSetupDate(e.target.value)}
                        max={eventEndDate || undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-200">Horário de montagem</label>
                      <Input
                        name="setup_time"
                        type="time"
                        required
                        value={setupTime}
                        onChange={(e) => setSetupTime(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {reserveMode ? (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm text-zinc-200">Nome do evento</label>
                      <Input
                        name="event_name"
                        placeholder="Ex: Festa de aniversário"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm text-zinc-200">Local (nome do salão)</label>
                      <Input
                        name="venue_name"
                        placeholder="Ex: Salão de festas"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm text-zinc-200">Observações</label>
                      <textarea
                        name="notes"
                        className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Detalhes do evento, restrições de acesso, etc."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="sm:col-span-2">
                <p className="text-sm text-zinc-300">Informe o CEP do evento e selecione o período para continuar.</p>
              </div>
            )}
          </div>
        </Card>
        {eventDaysMode ? (
          <>
            {reserveMode ? (
              <Card>
                <p className="text-sm text-zinc-400">2. Período e deslocamento</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {eventDaysMode === "single" ? (
                    <div className="space-y-2 sm:col-span-3">
                      <label className="text-sm text-zinc-200">Tipo de locação</label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                          <input
                            type="radio"
                            name="rental_charge_mode_ui"
                            value="hourly"
                            checked={rentalChargeMode === "hourly"}
                            onChange={() => setRentalChargeMode("hourly")}
                            disabled={pricingProfile === "day_block"}
                          />
                          Por hora
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                          <input
                            type="radio"
                            name="rental_charge_mode_ui"
                            value="daily"
                            checked={rentalChargeMode === "daily" || pricingProfile === "day_block"}
                            onChange={() => setRentalChargeMode("daily")}
                          />
                          Por diária (8h)
                        </label>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">Duração (horas)</label>
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      disabled={pricingProfile !== "hourly"}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                      <option value={7}>7</option>
                      <option value={8}>8</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">Distância (km)</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(Number(e.target.value))}
                      disabled={isDistancePending || !distanceError}
                    />
                    <p className="text-xs text-zinc-400">
                      {isDistancePending
                        ? "Calculando pelo CEP..."
                        : distanceError
                          ? "Não foi possível calcular automaticamente. Informe a distância manualmente."
                          : "Calculada automaticamente pelo CEP."}
                    </p>
                    {distanceError ? (
                      <p className="text-xs text-red-300">{distanceError}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">Pagamento</label>
                    <select
                      value={paymentPlan}
                      onChange={(e) => setPaymentPlan(e.target.value as PaymentPlanType)}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="pix">Pix (desconto)</option>
                      <option value="deposit">Sinal + restante</option>
                      <option value="installments">Parcelado</option>
                    </select>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <p className="text-sm text-zinc-400">{reserveMode ? "3" : "2"}. Equipamentos (disponíveis)</p>
              <div className="mt-4 grid gap-4">
                {!isEventReady ? (
                  <p className="text-sm text-zinc-300">
                    Preencha as datas e horários do evento para ver os equipamentos disponíveis.
                  </p>
                ) : isAvailabilityPending ? (
                  <p className="text-sm text-zinc-300">Carregando disponibilidade...</p>
                ) : availabilityError ? (
                  <p className="text-sm text-red-300">{availabilityError}</p>
                ) : filteredEquipments.length === 0 ? (
                  <p className="text-sm text-zinc-300">
                    Nenhum equipamento disponível para esse horário.
                  </p>
                ) : (
                  filteredEquipments.map((eq) => {
                    const availability = availabilityByEquipmentId[eq.id]
                    const availableQty = availability ? availability.available : 0
                    const qtyMax = availableQty
                    return (
                      <div
                        key={eq.id}
                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold">{eq.name}</p>
                          {eq.description ? (
                            <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">
                              {eq.description}
                            </p>
                          ) : null}
                          {eq.image_url ? (
                            <img
                              src={eq.image_url}
                              alt={eq.name}
                              className="mt-3 h-40 sm:h-80 w-full max-w-lg rounded-lg border border-white/10 bg-white/5 object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-zinc-300">Qtd</label>
                          <Input
                            type="number"
                            min={0}
                            max={Math.max(qtyMax, 0)}
                            step={1}
                            value={qtyById[eq.id] ?? ""}
                            placeholder="0"
                            onChange={(e) =>
                              setQtyById((prev) => {
                                const raw = e.target.value
                                const parsed = Number(raw)
                                const clamped =
                                  raw === ""
                                    ? ""
                                    : String(
                                        Math.max(
                                          0,
                                          Math.min(
                                            Math.trunc(Number.isFinite(parsed) ? parsed : 0),
                                            Math.max(qtyMax, 0)
                                          )
                                        )
                                      )
                                return { ...prev, [eq.id]: clamped }
                              })
                            }
                            className="w-24"
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            {reserveMode && items.length > 0 ? (
              <Card>
                <p className="text-sm text-zinc-400">4. Endereço do evento</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-zinc-200">Rua</label>
                    <Input
                      placeholder="Ex: Avenida Brasil"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      readOnly={lockByCep}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">Número</label>
                    <Input
                      inputMode="numeric"
                      placeholder="Ex: 123"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-zinc-200">Bairro</label>
                    <Input
                      placeholder="Ex: Centro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      readOnly={lockByCep}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">Complemento</label>
                    <Input
                      placeholder="Apto, bloco, referência"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-zinc-200">Cidade</label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} readOnly={lockByCep} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-200">UF</label>
                    <Input
                      maxLength={2}
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value)}
                      readOnly={lockByCep}
                    />
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="lg:col-span-1 space-y-4">
        {eventDaysMode ? (
          <Card>
            <p className="text-sm text-zinc-400">Resumo</p>
            <div className="mt-4 space-y-2 text-sm">
              {!isEventReady ? (
                <p className="text-sm text-zinc-300">
                  Preencha datas e horários do evento para ver os valores.
                </p>
              ) : summary.lines.length === 0 ? (
                <p className="text-sm text-zinc-300">
                  Selecione os equipamentos para ver o resumo.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {summary.lines.map((l) => (
                      <div key={l.equipmentId} className="flex items-center justify-between">
                        <span className="text-zinc-300">
                          {l.name} × {l.quantity}
                        </span>
                        <span className="font-semibold">{formatBRLFromCents(l.total_cents)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-zinc-300">Desconto</span>
                    <span className="font-semibold text-green-300">
                      -{formatBRLFromCents(summary.discount_cents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200">Total</span>
                    <span className="text-lg font-semibold">{formatBRLFromCents(summary.total_cents)}</span>
                  </div>
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-zinc-300">
              Selecione se o evento é de 1 dia ou mais dias para continuar.
            </p>
          </Card>
        )}

        <input type="hidden" name="items_json" value={JSON.stringify(items)} />
        <input type="hidden" name="duration_hours" value={String(effectiveDurationHours)} />
        <input type="hidden" name="distance_km" value={String(distanceKm)} />
        <input type="hidden" name="payment_plan" value={paymentPlan} />
        <input type="hidden" name="rental_charge_mode" value={rentalChargeMode} />

        {eventDaysMode ? (
          <>
            {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
            {isAuthenticated ? (
              reserveMode ? (
                <SubmitButton />
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={!isEventReady}
                  onClick={() => {
                    setReserveMode(true)
                  }}
                >
                  Continuar para reservar
                </Button>
              )
            ) : (
              <div className="space-y-2">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={!isEventReady}
                  onClick={() => {
                    setReserveMode(true)
                    snapshotSession(true)
                    router.push(loginHref)
                  }}
                >
                  Entrar para reservar
                </Button>
                <Button
                  type="button"
                  size="lg"
                  intent="secondary"
                  className="w-full"
                  disabled={!isEventReady}
                  onClick={() => {
                    setReserveMode(true)
                    snapshotSession(true)
                    router.push(cadastroHref)
                  }}
                >
                  Criar conta
                </Button>
              </div>
            )}
          </>
        ) : null}

        <p className="text-xs text-zinc-500">
          Integração de pagamento está mockada: a escolha fica registrada e o pedido
          vai para análise/confirmação.
        </p>
      </div>
    </form>
  )
}
