"use client"

import * as React from "react"
import { useFormState, useFormStatus } from "react-dom"
import type { Equipment, EquipmentPrice, PaymentPlanType, PricingConfig, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown, formatBRLFromCents } from "@/lib/pricing/calc"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { calcDistanceKmFromCep, createReservation, getEquipmentAvailability, type CreateReservationState } from "./actions"

type Props = {
  equipments: Equipment[]
  prices: EquipmentPrice[]
  config: PricingConfig
  refCode?: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      Enviar solicitação de reserva
    </Button>
  )
}

export function OrcamentoForm({ equipments, prices, config, refCode }: Props) {
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
  const [eventDate, setEventDate] = React.useState("")
  const [startTime, setStartTime] = React.useState("")
  const [postalCode, setPostalCode] = React.useState("")
  const [addressLine1, setAddressLine1] = React.useState("")
  const [addressNumber, setAddressNumber] = React.useState("")
  const [neighborhood, setNeighborhood] = React.useState("")
  const [city, setCity] = React.useState("")
  const [stateUf, setStateUf] = React.useState("")
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

  const breakdown = React.useMemo(
    () =>
      calcQuoteBreakdown({
        items,
        durationHours,
        distanceKm,
        paymentPlan,
        priceByEquipmentId,
        config
      }),
    [items, durationHours, distanceKm, paymentPlan, priceByEquipmentId, config]
  )

  const [state, action] = useFormState<CreateReservationState, FormData>(
    createReservation,
    {}
  )

  React.useEffect(() => {
    if (!eventDate || !startTime) {
      setAvailabilityByEquipmentId({})
      setAvailabilityError(null)
      return
    }

    startAvailabilityTransition(async () => {
      const res = await getEquipmentAvailability({
        eventDate,
        startTime,
        durationHours,
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
  }, [eventDate, startTime, durationHours, distanceKm])

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

  const isEventReady = Boolean(eventDate && startTime)
  const hasAvailabilityData = Object.keys(availabilityByEquipmentId).length > 0

  const filteredEquipments = React.useMemo<Equipment[]>(() => {
    if (!isEventReady) return []
    if (!hasAvailabilityData) return []
    return equipments.filter((eq) => (availabilityByEquipmentId[eq.id]?.available ?? 0) > 0)
  }, [equipments, availabilityByEquipmentId, isEventReady, hasAvailabilityData])

  return (
    <form action={action} className="mt-8 grid gap-6 lg:grid-cols-3">
      <input type="hidden" name="ref" value={refCode ?? ""} />
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <p className="text-sm text-zinc-400">1. Dados do evento</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Nome do evento</label>
              <Input name="event_name" placeholder="Ex: Festa de aniversário" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Data</label>
              <Input
                name="event_date"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Horário</label>
              <Input
                name="start_time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Local (nome do salão)</label>
              <Input name="venue_name" placeholder="Ex: Salão de festas" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">CEP</label>
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
                  }
                  if (next.length === 8) {
                    startDistanceTransition(async () => {
                      const res = await calcDistanceKmFromCep(next)
                      if (res.error) {
                        setDistanceError(res.error)
                        return
                      }
                      if (typeof res.distanceKm === "number") {
                        setDistanceKm(res.distanceKm)
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
            </div>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200">Rua</label>
                <Input
                  name="address_line1"
                  placeholder="Ex: Avenida Brasil"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  readOnly={lockByCep}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">Número</label>
                <Input
                  name="address_number"
                  inputMode="numeric"
                  placeholder="Ex: 123"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Bairro</label>
              <Input
                name="neighborhood"
                placeholder="Ex: Centro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                readOnly={lockByCep}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Complemento</label>
              <Input name="address_line2" placeholder="Apto, bloco, referência" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Cidade</label>
              <Input
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                readOnly={lockByCep}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">UF</label>
              <Input
                name="state"
                maxLength={2}
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value)}
                readOnly={lockByCep}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Observações</label>
              <textarea
                name="notes"
                className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Detalhes do evento, restrições de acesso, etc."
              />
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">2. Período e deslocamento</p>
          <div className="mt-4 grid gap-4">
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Duração (horas)</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
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

        <Card>
          <p className="text-sm text-zinc-400">3. Equipamentos (disponíveis)</p>
          <div className="mt-4 grid gap-4">
            {!isEventReady ? (
              <p className="text-sm text-zinc-300">
                Informe a data e o horário do evento para ver os equipamentos disponíveis.
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
                const price = priceByEquipmentId[eq.id]
                const totalQty =
                  typeof (eq as any)?.quantity_total === "number"
                    ? (eq as any).quantity_total
                    : 1
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
                      {eq.image_url ? (
                        <img
                          src={eq.image_url}
                          alt={eq.name}
                          className="mt-3 h-40 w-full max-w-lg rounded-lg border border-white/10 bg-white/5 object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <p className="text-sm text-zinc-400">
                        {eq.category ?? "Equipamento"} •{" "}
                        {price
                          ? `${formatBRLFromCents(price.price_per_hour_cents)}/h (mín. ${price.min_hours}h)`
                          : "Preço indisponível"}
                        {` • Disponível: ${availableQty}/${totalQty}`}
                      </p>
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
      </div>

      <div className="lg:col-span-1 space-y-4">
        <Card>
          <p className="text-sm text-zinc-400">Resumo</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Subtotal</span>
              <span className="font-semibold">
                {formatBRLFromCents(breakdown.subtotal_cents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Deslocamento</span>
              <span className="font-semibold">
                {formatBRLFromCents(breakdown.displacement_cents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Desconto</span>
              <span className="font-semibold text-green-300">
                -{formatBRLFromCents(breakdown.discount_cents)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-zinc-200">Total</span>
              <span className="text-lg font-semibold">
                {formatBRLFromCents(breakdown.total_cents)}
              </span>
            </div>
          </div>
        </Card>

        <input type="hidden" name="items_json" value={JSON.stringify(items)} />
        <input type="hidden" name="duration_hours" value={String(durationHours)} />
        <input type="hidden" name="distance_km" value={String(distanceKm)} />
        <input type="hidden" name="payment_plan" value={paymentPlan} />

        {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
        <SubmitButton />

        <p className="text-xs text-zinc-500">
          Integração de pagamento está mockada: a escolha fica registrada e o pedido
          vai para análise/confirmação.
        </p>
      </div>
    </form>
  )
}
