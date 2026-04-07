import Link from "next/link"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
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

export default async function ClientePage() {
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
  const cashbackPendingCents = cashbackTxs
    .filter((t) => t.status === "pending")
    .reduce((acc, t) => acc + (typeof t.amount_cents === "number" ? t.amount_cents : 0), 0)

  const baseUrl = getBaseUrl()
  const referralCode = profile?.referral_code ?? ""
  const referralLink = referralCode
    ? `${baseUrl || ""}/?ref=${encodeURIComponent(referralCode)}`
    : ""

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
            Ao concluir uma reserva via seu link, você recebe R$10,00 de cashback.
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
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm text-zinc-300">Histórico</p>
              {cashbackTxs.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">Nenhuma transação encontrada.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {cashbackTxs.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{formatBRLFromCents(t.amount_cents)}</span>
                        <span className="text-xs text-zinc-400">
                          {formatDate(t.created_at)} • {t.status}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {t.source_referral_id ? `Ref: ${t.source_referral_id}` : ""}
                      </span>
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
