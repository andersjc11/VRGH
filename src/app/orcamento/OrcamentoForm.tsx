"use client"

import * as React from "react"
import { useFormState, useFormStatus } from "react-dom"
import type { Equipment, EquipmentPrice, PaymentPlanType, PricingConfig, QuoteItemInput } from "@/lib/domain/types"
import { calcQuoteBreakdown, formatBRLFromCents } from "@/lib/pricing/calc"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { createReservation, type CreateReservationState } from "./actions"

type Props = {
  equipments: Equipment[]
  prices: EquipmentPrice[]
  config: PricingConfig
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      Enviar solicitação de reserva
    </Button>
  )
}

export function OrcamentoForm({ equipments, prices, config }: Props) {
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

  return (
    <form action={action} className="mt-8 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <p className="text-sm text-zinc-400">1. Equipamentos</p>
          <div className="mt-4 grid gap-4">
            {equipments.map((eq) => {
              const price = priceByEquipmentId[eq.id]
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
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-300">Qtd</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={qtyById[eq.id] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setQtyById((prev) => ({
                          ...prev,
                          [eq.id]: e.target.value
                        }))
                      }
                      className="w-24"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">2. Período e deslocamento</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Duração (horas)</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Distância (km)</label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
              />
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
          <p className="text-sm text-zinc-400">3. Dados do evento</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Nome do evento</label>
              <Input name="event_name" placeholder="Ex: Festa de aniversário" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Data</label>
              <Input name="event_date" type="date" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Horário</label>
              <Input name="start_time" type="time" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Local (nome do salão)</label>
              <Input name="venue_name" placeholder="Ex: Salão de festas" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Endereço</label>
              <Input name="address_line1" placeholder="Rua, número" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-zinc-200">Complemento</label>
              <Input name="address_line2" placeholder="Apto, bloco, referência" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Cidade</label>
              <Input name="city" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">UF</label>
              <Input name="state" maxLength={2} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">CEP</label>
              <Input name="postal_code" required />
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
