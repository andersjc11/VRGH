import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

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
          <p className="mt-1 break-all text-sm text-zinc-300">
            /?ref={profile?.referral_code ?? "—"}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Ao concluir uma reserva via seu link, você recebe R$10,00 de cashback.
          </p>
        </Card>

        <Card className="lg:col-span-3">
          <p className="text-sm text-zinc-400">Cashback</p>
          <p className="mt-2 font-semibold">Saldo e histórico</p>
          <p className="mt-1 text-sm text-zinc-300">
            Disponível na próxima etapa (ledger de cashback no schema).
          </p>
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
