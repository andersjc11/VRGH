import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireEnv } from "@/lib/env"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

function isNextRedirectError(err: unknown) {
  const digest = (err as any)?.digest
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT")
}

type WithdrawalRow = {
  id: string
  requester_id: string
  amount_cents: number
  pix_key: string
  status: string
  receipt_url: string | null
  receipt_path: string | null
  created_at: string
  paid_at: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  whatsapp: string | null
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
  return query ? `/admin/resgates?${query}` : "/admin/resgates"
}

function formatDateTimePtBR(iso: string | null | undefined) {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function formatBRLFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function statusLabel(status: string) {
  if (status === "requested") return "Solicitado"
  if (status === "paid") return "Pago"
  if (status === "cancelled") return "Cancelado"
  return status || "—"
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/resgates")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase, user }
}

const CASHBACK_RECEIPTS_BUCKET = "cashback-receipts"

function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  )
}

async function ensureReceiptBucketExists(admin: any) {
  const listRes = await admin.storage.listBuckets()
  if (listRes.error) {
    throw new Error(`Falha ao listar buckets: ${listRes.error.message}`)
  }

  const bucket = (listRes.data ?? []).find((b: any) => b?.name === CASHBACK_RECEIPTS_BUCKET)
  if (!bucket) {
    const createRes = await admin.storage.createBucket(CASHBACK_RECEIPTS_BUCKET, { public: false })
    if (createRes.error) {
      throw new Error(`Falha ao criar bucket de comprovantes: ${createRes.error.message}`)
    }
    return
  }

  if (bucket.public === true) {
    const updRes = await admin.storage.updateBucket(CASHBACK_RECEIPTS_BUCKET, { public: false })
    if (updRes.error) {
      throw new Error(`Falha ao atualizar bucket de comprovantes: ${updRes.error.message}`)
    }
  }
}

function extractReceiptPathFromPublicUrl(url: string | null | undefined) {
  if (!url) return ""
  const marker = `/${CASHBACK_RECEIPTS_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return ""
  return url.slice(idx + marker.length)
}

async function uploadReceipt(admin: any, file: File) {
  const originalName = typeof file.name === "string" ? file.name : "comprovante"
  const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "comprovante"
  const objectPath = `withdrawals/${crypto.randomUUID()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  const uploadRes = await admin.storage.from(CASHBACK_RECEIPTS_BUCKET).upload(objectPath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: true
  })

  if (uploadRes.error) throw new Error(`Falha ao enviar comprovante: ${uploadRes.error.message}`)

  return objectPath
}

export default async function AdminResgatesPage({
  searchParams
}: {
  searchParams?: { q?: string; status?: string; ok?: string; error?: string }
}) {
  async function markAsPaid(formData: FormData) {
    "use server"
    try {
      const { supabase, user } = await requireAdmin()

      const idRaw = formData.get("id")
      const id = typeof idRaw === "string" ? idRaw.trim() : ""
      if (!id) redirect("/admin/resgates?error=ID%20inv%C3%A1lido")

      const file = formData.get("receipt")
      if (!(file instanceof File) || file.size <= 0) {
        redirect(`/admin/resgates?error=Envie%20o%20comprovante.`)
      }

      const admin = createSupabaseAdminClient()
      await ensureReceiptBucketExists(admin)
      const receiptPath = await uploadReceipt(admin, file)

      const updRes = await supabase
        .from("cashback_withdrawals")
        .update({
          status: "paid",
          receipt_url: null,
          receipt_path: receiptPath,
          paid_by: user.id,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", id)

      if (updRes.error) {
        redirect(`/admin/resgates?error=${encodeURIComponent(updRes.error.message)}`)
      }

      redirect("/admin/resgates?ok=paid")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada."
      redirect(`/admin/resgates?error=${encodeURIComponent(message)}`)
    }
  }

  async function viewReceipt(formData: FormData) {
    "use server"
    try {
      const { supabase } = await requireAdmin()
      const idRaw = formData.get("id")
      const id = typeof idRaw === "string" ? idRaw.trim() : ""
      if (!id) redirect("/admin/resgates?error=ID%20inv%C3%A1lido")

      const rowRes = await supabase
        .from("cashback_withdrawals")
        .select("receipt_path,receipt_url")
        .eq("id", id)
        .maybeSingle()

      if (rowRes.error) redirect(`/admin/resgates?error=${encodeURIComponent(rowRes.error.message)}`)

      const receiptPath =
        typeof rowRes.data?.receipt_path === "string" && rowRes.data.receipt_path
          ? rowRes.data.receipt_path
          : extractReceiptPathFromPublicUrl(rowRes.data?.receipt_url)

      if (!receiptPath && rowRes.data?.receipt_url) redirect(rowRes.data.receipt_url)
      if (!receiptPath) redirect("/admin/resgates?error=Comprovante%20indispon%C3%ADvel.")

      const admin = createSupabaseAdminClient()
      await ensureReceiptBucketExists(admin)
      const signedRes = await admin.storage.from(CASHBACK_RECEIPTS_BUCKET).createSignedUrl(receiptPath, 60 * 10)
      if (signedRes.error) {
        redirect(`/admin/resgates?error=${encodeURIComponent(signedRes.error.message)}`)
      }

      const signedUrl = signedRes.data?.signedUrl
      if (!signedUrl) redirect("/admin/resgates?error=Falha%20ao%20gerar%20link%20do%20comprovante.")
      redirect(signedUrl)
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada."
      redirect(`/admin/resgates?error=${encodeURIComponent(message)}`)
    }
  }

  const q = searchParams?.q ?? ""
  const status =
    searchParams?.status === "paid"
      ? "paid"
      : searchParams?.status === "requested"
        ? "requested"
        : searchParams?.status === "cancelled"
          ? "cancelled"
          : ""

  const ok = searchParams?.ok
  const error = searchParams?.error

  const { supabase } = await requireAdmin()

  const baseQuery = supabase
    .from("cashback_withdrawals")
    .select("id,requester_id,amount_cents,pix_key,status,receipt_url,receipt_path,created_at,paid_at")
    .order("created_at", { ascending: false })
    .limit(200)

  const withdrawalsRes = status ? await baseQuery.eq("status", status) : await baseQuery
  if (withdrawalsRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: withdrawalsRes.error.message }))
  }

  const withdrawals = (withdrawalsRes.data ?? []) as WithdrawalRow[]
  const requesterIds = Array.from(new Set(withdrawals.map((w) => w.requester_id).filter(Boolean))) as string[]

  const profilesRes = requesterIds.length
    ? await supabase.from("profiles").select("id,full_name,phone,whatsapp").in("id", requesterIds)
    : { data: [], error: null as any }

  if (profilesRes.error) {
    redirect(buildUrl({ q: q || undefined, status: status || undefined, error: profilesRes.error.message }))
  }

  const profileById = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.id, p])) as Record<
    string,
    ProfileRow
  >

  const filtered = withdrawals.filter((w) => {
    if (!q) return true
    const profile = profileById[w.requester_id]
    const hay = `${profile?.full_name ?? ""} ${profile?.whatsapp ?? ""} ${profile?.phone ?? ""}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const requestedCents = filtered
    .filter((w) => w.status === "requested")
    .reduce((acc, w) => acc + (typeof w.amount_cents === "number" ? w.amount_cents : 0), 0)
  const paidCents = filtered
    .filter((w) => w.status === "paid")
    .reduce((acc, w) => acc + (typeof w.amount_cents === "number" ? w.amount_cents : 0), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Resgates</h1>
          <p className="text-zinc-300">Solicitações de resgate de cashback (Pix).</p>
        </div>
        <div className="flex gap-2">
          <Button asChild intent="ghost">
            <Link href="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {ok || error ? (
        <Card className="mt-6">
          {ok === "paid" ? <p className="text-sm text-emerald-200">Pagamento confirmado.</p> : null}
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <form method="get" className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input name="q" defaultValue={q} placeholder="Pesquisar por nome/telefone" autoComplete="off" />
        </div>
        <div className="flex-1">
          <select
            name="status"
            defaultValue={status}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos os status</option>
            <option value="requested">Solicitado</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" intent="secondary">
            Filtrar
          </Button>
          <Button asChild intent="ghost">
            <Link href="/admin/resgates">Limpar</Link>
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-zinc-400">Solicitado</p>
          <p className="mt-2 font-semibold">{formatBRLFromCents(requestedCents)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Pago</p>
          <p className="mt-2 font-semibold">{formatBRLFromCents(paidCents)}</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="divide-y divide-white/10">
          {filtered.length === 0 ? (
            <div className="p-4">
              <p className="text-zinc-300">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            filtered.map((w) => {
              const profile = profileById[w.requester_id]
              return (
                <div key={w.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatBRLFromCents(w.amount_cents)} • {statusLabel(w.status)}
                    </p>
                    <p className="mt-1 truncate text-sm text-zinc-400">
                      Cliente: {profile?.full_name ?? w.requester_id ?? "—"}
                      {(profile?.whatsapp || profile?.phone)
                        ? ` • ${profile?.whatsapp ?? profile?.phone}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">Chave Pix: {w.pix_key}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Solicitado em: {formatDateTimePtBR(w.created_at)} • Pago em: {formatDateTimePtBR(w.paid_at)}
                    </p>
                    {w.receipt_url || w.receipt_path ? (
                      <form action={viewReceipt} target="_blank" className="mt-1">
                        <input type="hidden" name="id" value={w.id} />
                        <Button type="submit" intent="ghost">
                          Ver comprovante
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {w.status === "requested" ? (
                    <form action={markAsPaid} className="flex flex-col gap-2 sm:items-end">
                      <input type="hidden" name="id" value={w.id} />
                      <input
                        name="receipt"
                        type="file"
                        accept="image/*,application/pdf"
                        className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
                      />
                      <Button type="submit" intent="secondary">
                        Marcar como pago
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Button asChild intent="secondary">
                        <Link href="/admin/cashback">Ver transações</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
