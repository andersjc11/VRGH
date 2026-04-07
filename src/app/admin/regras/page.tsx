import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseMoneyToCents(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim()
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function parseNumber(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim().replace(",", ".")
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parseIntSafe(raw: string) {
  const n = parseNumber(raw)
  if (n === null) return null
  return Math.trunc(n)
}

function isNextRedirectError(err: unknown) {
  const digest = (err as any)?.digest
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT")
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/regras")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

async function saveRules(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()

    const displacementBaseFeeCents = parseMoneyToCents(
      getString(formData, "displacement_base_fee")
    )
    const displacementFreeKm = parseNumber(getString(formData, "displacement_free_km"))
    const displacementPerKmCents = parseMoneyToCents(
      getString(formData, "displacement_per_km")
    )

    const pixDiscountPct = parseNumber(getString(formData, "pix_discount_pct"))
    const depositPct = parseNumber(getString(formData, "deposit_pct"))
    const maxInstallments = parseIntSafe(getString(formData, "max_installments"))

    if (displacementBaseFeeCents === null) {
      redirect("/admin/regras?error=Taxa%20base%20do%20deslocamento%20inv%C3%A1lida")
    }
    if (displacementFreeKm === null || displacementFreeKm < 0) {
      redirect("/admin/regras?error=KM%20gratuito%20inv%C3%A1lido")
    }
    if (displacementPerKmCents === null) {
      redirect("/admin/regras?error=Valor%20por%20km%20inv%C3%A1lido")
    }
    if (pixDiscountPct === null || pixDiscountPct < 0 || pixDiscountPct > 100) {
      redirect("/admin/regras?error=Desconto%20Pix%20inv%C3%A1lido")
    }
    if (depositPct === null || depositPct < 0 || depositPct > 100) {
      redirect("/admin/regras?error=Sinal%20inv%C3%A1lido")
    }
    if (maxInstallments === null || maxInstallments < 1 || maxInstallments > 24) {
      redirect("/admin/regras?error=N%C3%BAmero%20de%20parcelas%20inv%C3%A1lido")
    }

    const displacement = {
      base_fee_cents: displacementBaseFeeCents,
      free_km: displacementFreeKm,
      per_km_cents: displacementPerKmCents
    }

    const discounts = {
      pix_discount_pct: pixDiscountPct,
      deposit_pct: depositPct,
      max_installments: maxInstallments
    }

    const upsertRes = await supabase.from("pricing_settings").upsert(
      [
        { key: "displacement", value_json: displacement },
        { key: "discounts", value_json: discounts }
      ],
      { onConflict: "key" }
    )

    if (upsertRes.error) {
      redirect(
        `/admin/regras?error=${encodeURIComponent(
          `Falha ao salvar: ${upsertRes.error.message}`
        )}`
      )
    }

    redirect("/admin/regras?ok=1")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
    redirect(`/admin/regras?error=${encodeURIComponent(message)}`)
  }
}

export default async function AdminRegrasPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string }
}) {
  const { supabase } = await requireAdmin()

  const [displacementRes, discountsRes] = await Promise.all([
    supabase
      .from("pricing_settings")
      .select("value_json,updated_at")
      .eq("key", "displacement")
      .maybeSingle(),
    supabase
      .from("pricing_settings")
      .select("value_json,updated_at")
      .eq("key", "discounts")
      .maybeSingle()
  ])

  const displacement = displacementRes.data?.value_json ?? {}
  const discounts = discountsRes.data?.value_json ?? {}

  const ok = searchParams?.ok
  const error = searchParams?.error

  const baseFeeCents = Number(displacement.base_fee_cents ?? 0)
  const freeKm = Number(displacement.free_km ?? 10)
  const perKmCents = Number(displacement.per_km_cents ?? 500)

  const pixDiscountPct = Number(discounts.pix_discount_pct ?? 5)
  const depositPct = Number(discounts.deposit_pct ?? 30)
  const maxInstallments = Number(discounts.max_installments ?? 6)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Regras</h1>
        <p className="text-zinc-300">
          Gerencie taxas aplicadas à locação: deslocamento, desconto à vista e regras
          de pagamento.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild intent="secondary">
          <Link href="/admin">Voltar</Link>
        </Button>
      </div>

      {ok || error ? (
        <Card className="mt-6">
          {ok ? <p className="text-sm text-emerald-200">Salvo com sucesso.</p> : null}
          {error ? (
            <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p>
          ) : null}
        </Card>
      ) : null}

      <form action={saveRules} className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Deslocamento</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Taxa base (R$)</p>
              <Input
                name="displacement_base_fee"
                inputMode="decimal"
                defaultValue={(baseFeeCents / 100).toFixed(2)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">KM grátis</p>
              <Input
                name="displacement_free_km"
                inputMode="numeric"
                defaultValue={String(freeKm)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Valor por KM (R$)</p>
              <Input
                name="displacement_per_km"
                inputMode="decimal"
                defaultValue={(perKmCents / 100).toFixed(2)}
                placeholder="5,00"
              />
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">Pagamento e descontos</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Desconto Pix (%)</p>
              <Input
                name="pix_discount_pct"
                inputMode="decimal"
                defaultValue={String(pixDiscountPct)}
                placeholder="5"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Sinal (%)</p>
              <Input
                name="deposit_pct"
                inputMode="decimal"
                defaultValue={String(depositPct)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Máx. parcelas</p>
              <Input
                name="max_installments"
                inputMode="numeric"
                defaultValue={String(maxInstallments)}
                placeholder="6"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button asChild intent="secondary">
            <Link href="/admin">Cancelar</Link>
          </Button>
          <Button type="submit">Salvar regras</Button>
        </div>
      </form>
    </div>
  )
}
