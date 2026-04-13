import Link from "next/link"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ReferralLink } from "./ReferralLink"

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

type ReferralRow = {
  id: string
  reservation_id: string | null
  referred_id: string
  referrer_id: string
  status: string | null
  cashback_cents: number | null
}

type ReferredProfileRow = {
  id: string
  full_name: string | null
}

type ReferralReservationRow = {
  id: string
  status: string
  created_at: string
  event_name: string | null
  total_cents: number
}

type ReservationByRefRow = {
  id: string
  user_id: string
  status: string
  created_at: string
  event_name: string | null
  total_cents: number
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

function getBaseUrl() {
  const h = headers()
  const origin = h.get("origin")
  if (origin) return origin

  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (host) return `${proto}://${host}`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) return siteUrl

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`

  return ""
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
      return "Aguardando confirmação de pagamento"
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

function referralStatusLabel(status: string | null | undefined) {
  if (status === "approved") return "Aprovada"
  if (status === "pending") return "Pendente"
  if (status === "cancelled") return "Cancelada"
  return status ?? "—"
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

export default async function ClientePage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string }
}) {
  async function requestCashbackWithdrawal(formData: FormData) {
    "use server"
    const supabase = createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) redirect("/login?next=/cliente")

    const pixKeyRaw = formData.get("pix_key")
    const pixKey = typeof pixKeyRaw === "string" ? pixKeyRaw.trim() : ""
    if (!pixKey) redirect("/cliente?error=Informe%20a%20chave%20Pix.")

    const approvedRes = await supabase
      .from("cashback_transactions")
      .select("amount_cents,status")
      .eq("owner_profile_id", user.id)
      .eq("status", "approved")
      .limit(1000)

    if (approvedRes.error) {
      redirect(`/cliente?error=${encodeURIComponent(approvedRes.error.message)}`)
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
      redirect(`/cliente?error=${encodeURIComponent(reservedRes.error.message)}`)
    }

    const reservedCents = (reservedRes.data ?? []).reduce((acc: number, row: any) => {
      const cents = typeof row?.amount_cents === "number" ? row.amount_cents : 0
      return acc + cents
    }, 0)

    const availableCents = Math.max(0, approvedCents - reservedCents)
    if (availableCents <= 0) {
      redirect("/cliente?error=N%C3%A3o%20h%C3%A1%20saldo%20dispon%C3%ADvel%20para%20resgate.")
    }

    const insertRes = await supabase.from("cashback_withdrawals").insert({
      requester_id: user.id,
      amount_cents: availableCents,
      pix_key: pixKey,
      status: "requested"
    })

    if (insertRes.error) {
      redirect(`/cliente?error=${encodeURIComponent(insertRes.error.message)}`)
    }

    redirect("/cliente?ok=withdrawal_requested")
  }

  async function viewWithdrawalReceipt(formData: FormData) {
    "use server"
    try {
      const supabase = createSupabaseServerClient()
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) redirect("/login?next=/cliente")

      const idRaw = formData.get("id")
      const id = typeof idRaw === "string" ? idRaw.trim() : ""
      if (!id) redirect("/cliente?error=ID%20inv%C3%A1lido.")

      const rowRes = await supabase
        .from("cashback_withdrawals")
        .select("id,requester_id,receipt_url,receipt_path")
        .eq("id", id)
        .maybeSingle()

      if (rowRes.error) redirect(`/cliente?error=${encodeURIComponent(rowRes.error.message)}`)
      if (!rowRes.data) redirect("/cliente?error=Resgate%20n%C3%A3o%20encontrado.")
      if (rowRes.data.requester_id !== user.id) redirect("/cliente?error=Acesso%20negado.")

      const receiptPath =
        typeof rowRes.data.receipt_path === "string" && rowRes.data.receipt_path
          ? rowRes.data.receipt_path
          : extractReceiptPathFromPublicUrl(rowRes.data.receipt_url)

      if (!receiptPath && rowRes.data.receipt_url) redirect(rowRes.data.receipt_url)
      if (!receiptPath) redirect("/cliente?error=Comprovante%20indispon%C3%ADvel.")

      const admin = createSupabaseAdminClient()
      const signedRes = await admin.storage.from(CASHBACK_RECEIPTS_BUCKET).createSignedUrl(receiptPath, 60 * 10)
      if (signedRes.error) redirect(`/cliente?error=${encodeURIComponent(signedRes.error.message)}`)

      const signedUrl = signedRes.data?.signedUrl
      if (!signedUrl) redirect("/cliente?error=Falha%20ao%20gerar%20link%20do%20comprovante.")
      redirect(signedUrl)
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada."
      redirect(`/cliente?error=${encodeURIComponent(message)}`)
    }
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/cliente")

  const profileRes = await supabase
    .from("profiles")
    .select(
      "id,full_name,phone,whatsapp,cpf,address_line1,neighborhood,city,postal_code,role,referral_code"
    )
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRes.data as ProfileRow | null
  const clientDataComplete = Boolean(
    profile?.full_name &&
      profile?.cpf &&
      profile?.address_line1 &&
      profile?.neighborhood &&
      profile?.city &&
      profile?.postal_code &&
      (profile?.whatsapp || profile?.phone)
  )

  const reservationsRes = await supabase
    .from("reservations")
    .select("id,status,created_at,total_cents,payment_plan,event_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const reservations = (reservationsRes.data ?? []) as ReservationRow[]

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

  const baseUrl = getBaseUrl()
  const referralCode = profile?.referral_code ?? ""
  const referralLink = referralCode
    ? `${baseUrl || ""}/?ref=${encodeURIComponent(referralCode)}`
    : ""

  const admin = createSupabaseAdminClient()
  const referralsRes = await admin
    .from("referrals")
    .select("id,reservation_id,referred_id,referrer_id,status,cashback_cents")
    .eq("referrer_id", user.id)
    .limit(50)

  const referrals = (referralsRes.data ?? []) as ReferralRow[]
  const referredIds = Array.from(new Set(referrals.map((r) => r.referred_id).filter(Boolean))) as string[]
  const referredProfilesRes = referredIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", referredIds)
    : { data: [], error: null as any }

  const referredProfileById = Object.fromEntries((referredProfilesRes.data ?? []).map((p: any) => [p.id, p])) as Record<
    string,
    ReferredProfileRow
  >

  const reservationIds = Array.from(new Set(referrals.map((r) => r.reservation_id).filter(Boolean))) as string[]
  const referralReservationsRes = reservationIds.length
    ? await admin.from("reservations").select("id,status,created_at,event_name,total_cents").in("id", reservationIds)
    : { data: [], error: null as any }

  const reservationById = Object.fromEntries((referralReservationsRes.data ?? []).map((r: any) => [r.id, r])) as Record<
    string,
    ReferralReservationRow
  >

  const cashbackByReferralId = Object.fromEntries(
    cashbackTxs.filter((t) => t.source_referral_id).map((t) => [t.source_referral_id as string, t])
  ) as Record<string, CashbackTxRow>

  const reservationsByRefRes = referralCode
    ? await admin
        .from("reservations")
        .select("id,user_id,status,created_at,event_name,total_cents")
        .contains("payment_terms", { ref: referralCode })
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [], error: null as any }

  const reservationsByRef = (reservationsByRefRes.data ?? []) as ReservationByRefRow[]

  const reservationIdsWithReferral = new Set(
    referrals
      .map((r) => r.reservation_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id))
  )

  const derivedReservations = reservationsByRef
    .filter((r) => r.user_id !== user.id)
    .filter((r) => !reservationIdsWithReferral.has(r.id))

  const missingProfileIds = Array.from(
    new Set(derivedReservations.map((r) => r.user_id).filter((id) => id && !referredProfileById[id]))
  )

  const missingProfilesRes = missingProfileIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", missingProfileIds)
    : { data: [], error: null as any }

  for (const p of missingProfilesRes.data ?? []) {
    if (p?.id) referredProfileById[p.id] = p
  }

  const referralsSorted = [...referrals].sort((a, b) => {
    const aCreated = a.reservation_id ? reservationById[a.reservation_id]?.created_at : ""
    const bCreated = b.reservation_id ? reservationById[b.reservation_id]?.created_at : ""
    return String(bCreated).localeCompare(String(aCreated))
  })

  const indications = [
    ...referralsSorted.map((r) => {
      const reservation = r.reservation_id ? reservationById[r.reservation_id] : null
      const referred = referredProfileById[r.referred_id]
      const cashbackTx = cashbackByReferralId[r.id]
      const createdAt = reservation?.created_at ?? ""
      return {
        key: r.id,
        referredId: r.referred_id,
        referredName: referred?.full_name ? referred.full_name : `Cliente ${r.referred_id.slice(0, 6)}`,
        reservation: reservation
          ? { id: reservation.id, status: reservation.status, created_at: reservation.created_at, event_name: reservation.event_name }
          : null,
        referralStatus: r.status,
        cashbackCents: r.status === "pending"
          ? Math.floor((reservation?.total_cents ?? 20000) * 0.05)
          : (typeof r.cashback_cents === "number" ? r.cashback_cents : Math.floor((reservation?.total_cents ?? 20000) * 0.05)),
        cashbackStatus: cashbackTx?.status ?? ""
      }
    }),
    ...derivedReservations.map((res) => {
      const referred = referredProfileById[res.user_id]
      return {
        key: `res:${res.id}`,
        referredId: res.user_id,
        referredName: referred?.full_name ? referred.full_name : `Cliente ${res.user_id.slice(0, 6)}`,
        reservation: { id: res.id, status: res.status, created_at: res.created_at, event_name: res.event_name },
        referralStatus: "pending",
        cashbackCents: Math.floor((res.total_cents ?? 0) * 0.05),
        cashbackStatus: ""
      }
    })
  ].sort((a, b) => String(b.reservation?.created_at ?? "").localeCompare(String(a.reservation?.created_at ?? "")))

  const cashbackPendingCents = indications
    .filter((ind) => ind.referralStatus === "pending")
    .reduce((acc, ind) => acc + ind.cashbackCents, 0)

  const ok = searchParams?.ok
  const error = searchParams?.error

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Área do cliente</h1>
          <p className="text-zinc-300">
            Perfil, pedidos, status e cashback de indicações.
          </p>
        </div>
        <Button asChild>
          <Link href="/orcamento">Novo orçamento</Link>
        </Button>
      </div>

      {ok || error ? (
        <Card className="mt-6">
          {ok === "withdrawal_requested" ? (
            <p className="text-sm text-emerald-200">Solicitação de resgate enviada.</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <p className="text-sm text-zinc-400">Perfil</p>
          <p className="mt-2 font-semibold">
            {profile?.full_name ?? user.email ?? "Cliente"}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {profile?.whatsapp ?? profile?.phone ?? "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">Tipo: {profile?.role ?? "client"}</p>
        </Card>

        <Card className="lg:col-span-1">
          <p className="text-sm text-zinc-400">Dados do cliente</p>
          <p className="mt-2 font-semibold">
            {clientDataComplete ? "Completo" : "Pendente"}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Necessário para formalizar a reserva e gerar o termo.
          </p>
          <div className="mt-4">
            <Button asChild intent={clientDataComplete ? "secondary" : "primary"}>
              <Link href="/cliente/dados">
                {clientDataComplete ? "Ver/editar dados" : "Preencher agora"}
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <p className="text-sm text-zinc-400">Indicação</p>
          <p className="mt-2 font-semibold">Seu link exclusivo</p>
          <ReferralLink url={referralLink} />
          <p className="mt-2 text-xs text-zinc-400">
            Ao concluir uma reserva via seu link, você recebe 5% do valor em cashback.
          </p>
        </Card>

        <Card className="lg:col-span-3">
          <p className="text-sm text-zinc-400">Cashback</p>
          <div className="mt-2 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-sm text-zinc-300">Saldo aprovado</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatBRLFromCents(cashbackApprovedCents)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Pendente: {formatBRLFromCents(cashbackPendingCents)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Disponível para resgate: {formatBRLFromCents(cashbackAvailableToWithdrawCents)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Resgate solicitado: {formatBRLFromCents(withdrawalRequestedCents)} • Pago:{" "}
                {formatBRLFromCents(withdrawalPaidCents)}
              </p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm text-zinc-300">Indicações</p>
              {indications.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">Você ainda não tem indicações com contratação.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {indications.slice(0, 10).map((row) => {
                    const reservation = row.reservation
                    const isComplete = reservation?.status === "completed"
                    return (
                      <div
                        key={row.key}
                        className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between ${
                          isComplete ? "border-blue-400/25 bg-blue-500/10" : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {row.referredName}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {reservation?.event_name ? `${reservation.event_name} • ` : ""}
                            {reservation?.created_at ? `${formatDate(reservation.created_at)} • ` : ""}
                            Status: {reservationStatusLabel(reservation?.status)} • Indicação:{" "}
                            {referralStatusLabel(row.referralStatus)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-400">
                            Cashback:{" "}
                            {formatBRLFromCents(row.cashbackCents)}
                            {row.cashbackStatus ? ` • ${row.cashbackStatus}` : ""}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-sm text-zinc-300">Solicitar resgate via Pix</p>
              <p className="mt-1 text-xs text-zinc-400">
                O valor do resgate é calculado automaticamente com base no saldo disponível.
              </p>
              <form action={requestCashbackWithdrawal} className="mt-3 space-y-2">
                <Input name="pix_key" placeholder="Sua chave Pix (CPF, e-mail, celular ou aleatória)" autoComplete="off" />
                <Button type="submit" intent="secondary" disabled={cashbackAvailableToWithdrawCents <= 0}>
                  Solicitar resgate de {formatBRLFromCents(cashbackAvailableToWithdrawCents)}
                </Button>
              </form>
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm text-zinc-300">Resgates</p>
              {withdrawals.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">Nenhuma solicitação de resgate.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {withdrawals.slice(0, 10).map((w) => (
                    <div
                      key={w.id}
                      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{formatBRLFromCents(w.amount_cents)}</span>
                        <span className="text-xs text-zinc-400">
                          {formatDate(w.created_at)} • {w.status}
                          {w.paid_at ? ` • pago em ${formatDate(w.paid_at)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {w.receipt_url || w.receipt_path ? (
                          <form action={viewWithdrawalReceipt} target="_blank">
                            <input type="hidden" name="id" value={w.id} />
                            <Button type="submit" intent="ghost">
                              Comprovante
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Pedidos recentes</h2>
        <div className="grid gap-3">
          {reservations.length === 0 ? (
            <Card>
              <p className="text-zinc-300">
                Você ainda não enviou nenhuma solicitação de reserva.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/orcamento">Fazer primeiro orçamento</Link>
                </Button>
              </div>
            </Card>
          ) : (
            reservations.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {r.event_name ?? "Evento"}{" "}
                    <span className="text-sm font-normal text-zinc-400">
                      • {formatDate(r.created_at)}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-300">
                    Status: {r.status} • Pagamento: {r.payment_plan}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <p className="font-semibold">{formatBRLFromCents(r.total_cents)}</p>
                  <Button asChild intent="secondary">
                    <Link href={`/cliente/pedidos/${r.id}`}>Detalhes</Link>
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
