import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export const dynamic = "force-dynamic"

type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  whatsapp?: string | null
  cpf?: string | null
  address_line1?: string | null
  neighborhood?: string | null
  city?: string | null
  postal_code?: string | null
  role: string
  referral_code: string
}

type ReservationRow = {
  id: string
  status: string
  created_at: string
  total_cents: number
  payment_plan: string
  event_name: string | null
}

type CashbackTxRow = {
  id: string
  amount_cents: number
  status: string
  created_at: string
  source_referral_id: string | null
}

type CashbackWithdrawalRow = {
  id: string
  amount_cents: number
  pix_key: string
  status: string
  receipt_url: string | null
  receipt_path: string | null
  created_at: string
  paid_at: string | null
}

function formatDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString("pt-BR")
}

function formatBRLFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  })
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isNextRedirectError(err: unknown) {
  const digest = (err as any)?.digest
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT")
}

function reservationStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "submitted":
      return "Solicitação enviada"
    case "in_review":
      return "Aguardando pagamento"
    case "confirmed":
      return "Pagamento realizado"
    case "cancelled":
      return "Reserva cancelada"
    case "completed":
      return "Reserva concluída"
    default:
      return status ?? "—"
  }
}

function paymentPlanLabel(plan: string | null | undefined) {
  switch (plan) {
    case "installments":
      return "Parcelado"
    case "deposit":
      return "Entrada"
    case "pix":
      return "PIX"
    default:
      return plan ?? "—"
  }
}

const CASHBACK_RECEIPTS_BUCKET = "cashback-receipts"

function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  )
}

function extractReceiptPathFromPublicUrl(url: string | null | undefined) {
  if (!url) return ""
  const marker = `/${CASHBACK_RECEIPTS_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return ""
  return url.slice(idx + marker.length)
}

export default async function VendasDashboardPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string }
}) {
  async function requestCashbackWithdrawal(formData: FormData) {
    "use server"
    const supabase = createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) redirect("/login?next=/vendas")

    const pixKeyRaw = formData.get("pix_key")
    const pixKey = typeof pixKeyRaw === "string" ? pixKeyRaw.trim() : ""
    if (!pixKey) redirect("/vendas?error=Informe%20a%20chave%20Pix.")

    const approvedRes = await supabase
      .from("cashback_transactions")
      .select("amount_cents,status")
      .eq("owner_profile_id", user.id)
      .eq("status", "approved")
      .limit(1000)

    if (approvedRes.error) {
      redirect(`/vendas?error=${encodeURIComponent(approvedRes.error.message)}`)
    }

    const approvedCents = (approvedRes.data ?? []).reduce((acc: number, row: any) => {
      const cents = typeof row?.amount_cents === "number" ? row.amount_cents : 0
      return acc + cents
    }, 0)

    const reservedRes = await supabase
      .from("cashback_withdrawals")
      .select("amount_cents,status")
      .eq("requester_id", user.id)
      .in("status", ["requested", "paid"])
      .limit(1000)

    if (reservedRes.error) {
      redirect(`/vendas?error=${encodeURIComponent(reservedRes.error.message)}`)
    }

    const reservedCents = (reservedRes.data ?? []).reduce((acc: number, row: any) => {
      const cents = typeof row?.amount_cents === "number" ? row.amount_cents : 0
      return acc + cents
    }, 0)

    const availableCents = Math.max(0, approvedCents - reservedCents)
    if (availableCents <= 0) {
      redirect("/vendas?error=N%C3%A3o%20h%C3%A1%20saldo%20dispon%C3%ADvel%20para%20resgate.")
    }

    const insertRes = await supabase.from("cashback_withdrawals").insert({
      requester_id: user.id,
      amount_cents: availableCents,
      pix_key: pixKey,
      status: "requested"
    })

    if (insertRes.error) {
      redirect(`/vendas?error=${encodeURIComponent(insertRes.error.message)}`)
    }

    redirect("/vendas?ok=withdrawal_requested")
  }

  async function viewWithdrawalReceipt(formData: FormData) {
    "use server"
    try {
      const supabase = createSupabaseServerClient()
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) redirect("/login?next=/vendas")

      const idRaw = formData.get("id")
      const id = typeof idRaw === "string" ? idRaw.trim() : ""
      if (!id) redirect("/vendas?error=ID%20inv%C3%A1lido.")

      const rowRes = await supabase
        .from("cashback_withdrawals")
        .select("id,requester_id,receipt_url,receipt_path")
        .eq("id", id)
        .maybeSingle()

      if (rowRes.error) redirect(`/vendas?error=${encodeURIComponent(rowRes.error.message)}`)
      if (!rowRes.data) redirect("/vendas?error=Resgate%20n%C3%A3o%20encontrado.")
      if (rowRes.data.requester_id !== user.id) redirect("/vendas?error=Acesso%20negado.")

      const receiptPath =
        typeof rowRes.data.receipt_path === "string" && rowRes.data.receipt_path
          ? rowRes.data.receipt_path
          : extractReceiptPathFromPublicUrl(rowRes.data.receipt_url)

      if (!receiptPath && rowRes.data.receipt_url) redirect(rowRes.data.receipt_url)
      if (!receiptPath) redirect("/vendas?error=Comprovante%20indispon%C3%ADvel.")

      const admin = createSupabaseAdminClient()
      const signedRes = await admin.storage.from(CASHBACK_RECEIPTS_BUCKET).createSignedUrl(receiptPath, 60 * 10)
      if (signedRes.error) redirect(`/vendas?error=${encodeURIComponent(signedRes.error.message)}`)

      const signedUrl = signedRes.data?.signedUrl
      if (!signedUrl) redirect("/vendas?error=Falha%20ao%20gerar%20link%20do%20comprovante.")
      redirect(signedUrl)
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada."
      redirect(`/vendas?error=${encodeURIComponent(message)}`)
    }
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/vendas")

  const profileRes = await supabase
    .from("profiles")
    .select(
      "id,full_name,phone,whatsapp,cpf,address_line1,neighborhood,city,postal_code,role,referral_code"
    )
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRes.data as ProfileRow | null
  if (profile?.role !== "sales" && profile?.role !== "client" && profile?.role !== "admin") redirect("/")

  const cashbackRes = await supabase
    .from("cashback_transactions")
    .select("id,amount_cents,status,created_at,source_referral_id")
    .eq("owner_profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const cashbackTxs = (cashbackRes.data ?? []) as CashbackTxRow[]
  const cashbackApprovedCents = cashbackTxs
    .filter((t) => t.status === "approved")
    .reduce((acc, t) => acc + (typeof t.amount_cents === "number" ? t.amount_cents : 0), 0)

  const withdrawalsRes = await supabase
    .from("cashback_withdrawals")
    .select("id,amount_cents,pix_key,status,receipt_url,receipt_path,created_at,paid_at")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const withdrawals = (withdrawalsRes.data ?? []) as CashbackWithdrawalRow[]
  const withdrawalRequestedCents = withdrawals
    .filter((w) => w.status === "requested")
    .reduce((acc, w) => acc + (typeof w.amount_cents === "number" ? w.amount_cents : 0), 0)
  const withdrawalPaidCents = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((acc, w) => acc + (typeof w.amount_cents === "number" ? w.amount_cents : 0), 0)
  const cashbackAvailableToWithdrawCents = Math.max(0, cashbackApprovedCents - withdrawalRequestedCents - withdrawalPaidCents)

  const admin = createSupabaseAdminClient()
  const pendingReservationsRes = await admin
    .from("reservations")
    .select("total_cents,status")
    .contains("payment_terms", { manual_bonus_id: user.id })
    .in("status", ["submitted", "in_review"])
    .limit(1000)

  const cashbackPendingCents = (pendingReservationsRes.data ?? []).reduce((acc: number, r: any) => {
    const total = typeof r?.total_cents === "number" ? r.total_cents : 0
    return acc + Math.floor(total * 0.05)
  }, 0)

  const reservationsRes = await admin
    .from("reservations")
    .select("id,status,created_at,total_cents,payment_plan,event_name")
    .contains("payment_terms", { manual_bonus_id: user.id })
    .order("created_at", { ascending: false })
    .limit(10)

  const reservations = (reservationsRes.data ?? []) as ReservationRow[]

  const ok = searchParams?.ok
  const error = searchParams?.error

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-brand-300">Dashboard de Vendas</h1>
          <p className="text-zinc-300">
            Gerencie seus orçamentos e solicite resgates.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild size="lg" className="shadow-lg shadow-brand-500/20">
            <Link href="/orcamento">Gerar Novo Orçamento</Link>
          </Button>
        </div>
      </div>

      {ok || error ? (
        <Card className="mt-6 border-brand-500/30 bg-brand-500/5">
          {ok === "withdrawal_requested" ? (
            <p className="text-sm text-emerald-200">Solicitação de resgate enviada com sucesso.</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-white/5 bg-white/[0.02]">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-white">Meu Perfil</h2>
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-zinc-200">
                {profile?.full_name ?? user.email ?? "Vendedor"}
              </p>
              <p className="text-sm text-zinc-400">
                {profile?.whatsapp ?? profile?.phone ?? "—"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
                Função: {profile?.role === "admin" ? "Administrador" : "Equipe de Vendas"}
              </p>
            </div>
            <div className="mt-2">
              <Button asChild intent="secondary" size="md">
                <Link href="/cliente/dados">Editar Dados</Link>
              </Button>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-semibold text-white">Resumo Financeiro</h2>
          <div className="mt-4 space-y-4 rounded-2xl border border-white/5 bg-white/5 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400">Saldo Aprovado</p>
              <p className="text-3xl font-bold text-brand-300">{formatBRLFromCents(cashbackApprovedCents)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pendente</p>
                <p className="text-sm font-semibold text-zinc-300">{formatBRLFromCents(cashbackPendingCents)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Disponível</p>
                <p className="text-sm font-semibold text-emerald-400">{formatBRLFromCents(cashbackAvailableToWithdrawCents)}</p>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-zinc-400">Solicitar Resgate via Pix</p>
              <form action={requestCashbackWithdrawal} className="space-y-2">
                <Input name="pix_key" placeholder="Sua chave Pix" className="bg-black/20" />
                <Button type="submit" intent="primary" className="w-full" disabled={cashbackAvailableToWithdrawCents <= 0}>
                  Resgatar {formatBRLFromCents(cashbackAvailableToWithdrawCents)}
                </Button>
              </form>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3 border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-semibold text-white mb-4">Orçamentos Gerados por Mim</h2>
          {reservations.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4">Você ainda não gerou orçamentos com seu login.</p>
          ) : (
            <div className="grid gap-3">
              {reservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-100">{r.event_name ?? "Evento sem nome"}</p>
                    <p className="text-xs text-zinc-400">
                      {formatDate(r.created_at)} • {reservationStatusLabel(r.status)} • {paymentPlanLabel(r.payment_plan)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-brand-200">{formatBRLFromCents(r.total_cents)}</p>
                    <Button asChild intent="primary" size="md">
                      <Link href={`/cliente/pedidos/${r.id}?edit=1&view=1`}>Editar</Link>
                    </Button>
                    <Button asChild intent="secondary" size="md">
                      <Link href={`/cliente/pedidos/${r.id}?view=1`}>Ver Detalhes</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
