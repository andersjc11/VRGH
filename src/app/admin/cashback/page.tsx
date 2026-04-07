import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

type CashbackTxRow = {
  id: string
  owner_profile_id: string | null
  amount_cents: number
  status: "pending" | "approved" | "cancelled" | string
  source_referral_id: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  whatsapp: string | null
}

type ReferralRow = {
  id: string
  reservation_id: string | null
  referred_id: string
  referrer_id: string
}

type ReservationRow = {
  id: string
  event_name: string | null
  status: string
  payment_plan: string
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function buildUrl(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value)
  }
  const query = usp.toString()
  return query ? `/admin/cashback?${query}` : "/admin/cashback"
}

function formatDateTimePtBR(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function formatBRLFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function statusLabel(status: string) {
  if (status === "approved") return "Aprovado"
  if (status === "pending") return "Pendente"
  if (status === "cancelled") return "Cancelado"
  return status || "—"
}

function createSupabaseAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  })
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/cashback")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

export default async function AdminCashbackPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; error?: string }
}) {
  const q = searchParams?.q ?? ""
  const status =
    searchParams?.status === "approved"
      ? "approved"
      : searchParams?.status === "pending"
        ? "pending"
        : searchParams?.status === "cancelled"
          ? "cancelled"
          : ""

  const error = searchParams?.error

  const { supabase } = await requireAdmin()

  const baseQuery = supabase
    .from("cashback_transactions")
    .select("id,owner_profile_id,amount_cents,status,source_referral_id,created_at")
    .not("owner_profile_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  const txRes = status ? await baseQuery.eq("status", status) : await baseQuery
  if (txRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: txRes.error.message }))
  }

  const txs = (txRes.data ?? []) as CashbackTxRow[]
  const ownerIds = Array.from(new Set(txs.map((t) => t.owner_profile_id).filter(Boolean))) as string[]
  const referralIds = Array.from(new Set(txs.map((t) => t.source_referral_id).filter(Boolean))) as string[]

  const profilesRes = ownerIds.length
    ? await supabase.from("profiles").select("id,full_name,phone,whatsapp").in("id", ownerIds)
    : { data: [], error: null as any }

  if (profilesRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: profilesRes.error.message }))
  }

  const profileById = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.id, p])) as Record<
    string,
    ProfileRow
  >

  const referralsRes = referralIds.length
    ? await supabase.from("referrals").select("id,reservation_id,referred_id,referrer_id").in("id", referralIds)
    : { data: [], error: null as any }

  if (referralsRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: referralsRes.error.message }))
  }

  const referralById = Object.fromEntries((referralsRes.data ?? []).map((r: any) => [r.id, r])) as Record<
    string,
    ReferralRow
  >

  const reservationIds = Array.from(
    new Set((referralsRes.data ?? []).map((r: any) => r.reservation_id).filter(Boolean))
  ) as string[]

  const reservationsRes = reservationIds.length
    ? await supabase.from("reservations").select("id,event_name,status,payment_plan").in("id", reservationIds)
    : { data: [], error: null as any }

  if (reservationsRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: reservationsRes.error.message }))
  }

  const reservationById = Object.fromEntries((reservationsRes.data ?? []).map((r: any) => [r.id, r])) as Record<
    string,
    ReservationRow
  >

  let emailByUserId: Record<string, string> = {}
  try {
    const admin = createSupabaseAdminClient()
    const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailByUserId = Object.fromEntries(
      (usersRes.data.users ?? [])
        .map((u: any) => [u.id, u.email])
        .filter((entry: any) => Boolean(entry[0]) && Boolean(entry[1]))
    )
  } catch {
    emailByUserId = {}
  }

  const enriched = txs
    .map((t) => {
      const ownerId = t.owner_profile_id
      const profile = ownerId ? profileById[ownerId] : null
      const referral = t.source_referral_id ? referralById[t.source_referral_id] : null
      const reservation = referral?.reservation_id ? reservationById[referral.reservation_id] : null
      const email = ownerId ? emailByUserId[ownerId] : ""
      return { tx: t, profile, email, referral, reservation }
    })
    .filter((row) => {
      if (!q) return true
      const ql = q.toLowerCase()
      return (
        String(row.email ?? "").toLowerCase().includes(ql) ||
        String(row.profile?.full_name ?? "").toLowerCase().includes(ql)
      )
    })

  const approvedCents = enriched
    .filter((r) => r.tx.status === "approved")
    .reduce((acc, r) => acc + (typeof r.tx.amount_cents === "number" ? r.tx.amount_cents : 0), 0)
  const pendingCents = enriched
    .filter((r) => r.tx.status === "pending")
    .reduce((acc, r) => acc + (typeof r.tx.amount_cents === "number" ? r.tx.amount_cents : 0), 0)
  const cancelledCents = enriched
    .filter((r) => r.tx.status === "cancelled")
    .reduce((acc, r) => acc + (typeof r.tx.amount_cents === "number" ? r.tx.amount_cents : 0), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Cashback</h1>
          <p className="text-zinc-300">Transações de cashback geradas para clientes.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild intent="ghost">
            <Link href="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="mt-6">
          <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p>
        </Card>
      ) : null}

      <form method="get" className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input name="q" defaultValue={q} placeholder="Pesquisar por e-mail ou nome" autoComplete="off" />
        </div>
        <div className="flex-1">
          <select
            name="status"
            defaultValue={status}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos os status</option>
            <option value="approved">Aprovado</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" intent="secondary">
            Filtrar
          </Button>
          <Button asChild intent="ghost">
            <Link href="/admin/cashback">Limpar</Link>
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Aprovado</p>
          <p className="mt-2 font-semibold">{formatBRLFromCents(approvedCents)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Pendente</p>
          <p className="mt-2 font-semibold">{formatBRLFromCents(pendingCents)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Cancelado</p>
          <p className="mt-2 font-semibold">{formatBRLFromCents(cancelledCents)}</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="divide-y divide-white/10">
          {enriched.length === 0 ? (
            <div className="p-4">
              <p className="text-zinc-300">Nenhuma transação encontrada.</p>
            </div>
          ) : (
            enriched.map(({ tx, profile, email, referral, reservation }) => (
              <div key={tx.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {formatBRLFromCents(tx.amount_cents)} • {statusLabel(tx.status)}
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    Cliente: {email || profile?.full_name || tx.owner_profile_id || "—"}
                    {(profile?.whatsapp || profile?.phone)
                      ? ` • ${profile?.whatsapp ?? profile?.phone}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">Gerado em: {formatDateTimePtBR(tx.created_at)}</p>
                  {reservation ? (
                    <p className="mt-1 text-sm text-zinc-300">
                      Pedido: {reservation.event_name ?? "Evento"} • {reservation.status} • {reservation.payment_plan}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
                  {referral?.reservation_id ? (
                    <Button asChild intent="secondary">
                      <Link href={`/admin/pedidos/${referral.reservation_id}`}>Ver pedido</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

