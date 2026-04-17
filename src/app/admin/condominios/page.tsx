import Link from "next/link"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

type CondominiumRow = {
  id: string
  name: string
  code: string
  discount_pct: number
  active: boolean
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseNumber(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim().replace(",", ".")
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parsePct(raw: string) {
  const n = parseNumber(raw)
  if (n === null) return null
  const pct = Math.trunc(n)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null
  return pct
}

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase()
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

function parseCondominiums(valueJson: any): CondominiumRow[] {
  const list = Array.isArray(valueJson) ? valueJson : Array.isArray(valueJson?.items) ? valueJson.items : []
  return list
    .map((r: any) => ({
      id: typeof r?.id === "string" ? r.id : "",
      name: typeof r?.name === "string" ? r.name : "",
      code: normalizeCode(typeof r?.code === "string" ? r.code : ""),
      discount_pct: Number.isFinite(Number(r?.discount_pct)) ? Math.trunc(Number(r.discount_pct)) : 0,
      active: r?.active !== false
    }))
    .filter((r: CondominiumRow) => r.id && r.code)
}

function buildOrigin() {
  const h = headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  return host ? `${proto}://${host}` : ""
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/condominios")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

async function loadCondominiums(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const res = await supabase
    .from("pricing_settings")
    .select("value_json,updated_at")
    .eq("key", "condominiums")
    .maybeSingle()
  return { rows: parseCondominiums(res.data?.value_json), updatedAt: res.data?.updated_at as string | undefined }
}

async function saveAll(rows: CondominiumRow[], supabase: ReturnType<typeof createSupabaseServerClient>) {
  const valueJson = { items: rows }
  const upsertRes = await supabase.from("pricing_settings").upsert(
    [{ key: "condominiums", value_json: valueJson }],
    { onConflict: "key" }
  )
  return upsertRes
}

async function createCondominium(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()
    const { rows } = await loadCondominiums(supabase)

    const name = getString(formData, "name")
    const code = normalizeCode(getString(formData, "code"))
    const discountPct = parsePct(getString(formData, "discount_pct"))

    if (!name) redirect("/admin/condominios?error=Informe%20o%20nome%20do%20condom%C3%ADnio")
    if (!code) redirect("/admin/condominios?error=Informe%20um%20c%C3%B3digo%20para%20o%20QR%20Code")
    if (discountPct === null) redirect("/admin/condominios?error=Desconto%20inv%C3%A1lido")

    const duplicated = rows.some((r) => r.code === code)
    if (duplicated) redirect("/admin/condominios?error=C%C3%B3digo%20j%C3%A1%20cadastrado")

    const nextRow: CondominiumRow = {
      id: crypto.randomUUID(),
      name,
      code,
      discount_pct: discountPct,
      active: true
    }

    const upsertRes = await saveAll([...rows, nextRow], supabase)
    if (upsertRes.error) {
      redirect(`/admin/condominios?error=${encodeURIComponent(`Falha ao salvar: ${upsertRes.error.message}`)}`)
    }
    redirect("/admin/condominios?ok=1")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
    redirect(`/admin/condominios?error=${encodeURIComponent(message)}`)
  }
}

async function updateCondominium(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()
    const { rows } = await loadCondominiums(supabase)

    const id = getString(formData, "id")
    const name = getString(formData, "name")
    const code = normalizeCode(getString(formData, "code"))
    const discountPct = parsePct(getString(formData, "discount_pct"))
    const active = getString(formData, "active") === "1"

    if (!id) redirect("/admin/condominios?error=ID%20inv%C3%A1lido")
    if (!name) redirect("/admin/condominios?error=Nome%20inv%C3%A1lido")
    if (!code) redirect("/admin/condominios?error=C%C3%B3digo%20inv%C3%A1lido")
    if (discountPct === null) redirect("/admin/condominios?error=Desconto%20inv%C3%A1lido")

    const duplicated = rows.some((r) => r.id !== id && r.code === code)
    if (duplicated) redirect("/admin/condominios?error=C%C3%B3digo%20j%C3%A1%20cadastrado")

    const next = rows.map((r) =>
      r.id === id ? { ...r, name, code, discount_pct: discountPct, active } : r
    )

    const upsertRes = await saveAll(next, supabase)
    if (upsertRes.error) {
      redirect(`/admin/condominios?error=${encodeURIComponent(`Falha ao salvar: ${upsertRes.error.message}`)}`)
    }
    redirect("/admin/condominios?ok=1")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
    redirect(`/admin/condominios?error=${encodeURIComponent(message)}`)
  }
}

async function deleteCondominium(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()
    const { rows } = await loadCondominiums(supabase)

    const id = getString(formData, "id")
    if (!id) redirect("/admin/condominios?error=ID%20inv%C3%A1lido")

    const next = rows.filter((r) => r.id !== id)
    const upsertRes = await saveAll(next, supabase)
    if (upsertRes.error) {
      redirect(`/admin/condominios?error=${encodeURIComponent(`Falha ao excluir: ${upsertRes.error.message}`)}`)
    }
    redirect("/admin/condominios?ok=1")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao excluir."
    redirect(`/admin/condominios?error=${encodeURIComponent(message)}`)
  }
}

export default async function AdminCondominiosPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string }
}) {
  const { supabase } = await requireAdmin()
  const { rows } = await loadCondominiums(supabase)
  const origin = buildOrigin()

  const ok = searchParams?.ok
  const error = searchParams?.error

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Condomínios</h1>
        <p className="text-zinc-300">
          Cadastre condomínios e o desconto aplicado automaticamente quando o acesso vier do QR
          Code.
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
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <form action={createCondominium} className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Novo condomínio</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Nome</p>
              <Input name="name" placeholder="Ex: Residencial das Flores" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Código (QR)</p>
              <Input name="code" placeholder="Ex: FLORES10" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Desconto (%)</p>
              <Input name="discount_pct" inputMode="numeric" placeholder="10" />
            </div>
          </div>
          <div className="mt-4">
            <Button type="submit">Cadastrar</Button>
          </div>
        </Card>
      </form>

      <div className="mt-8 grid gap-4">
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-300">Nenhum condomínio cadastrado.</p>
          </Card>
        ) : (
          rows.map((row) => {
            const url = origin
              ? `${origin}/orcamento?condo=${encodeURIComponent(row.code)}`
              : `/orcamento?condo=${encodeURIComponent(row.code)}`
            const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`
            return (
              <Card key={row.id}>
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="space-y-3">
                    <form action={updateCondominium} className="grid gap-3">
                      <input type="hidden" name="id" value={row.id} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-sm text-zinc-200">Nome</p>
                          <Input name="name" defaultValue={row.name} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-zinc-200">Código</p>
                          <Input name="code" defaultValue={row.code} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-zinc-200">Desconto (%)</p>
                          <Input name="discount_pct" inputMode="numeric" defaultValue={String(row.discount_pct)} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
                          <input
                            type="checkbox"
                            name="active"
                            value="1"
                            defaultChecked={row.active}
                            className="h-4 w-4"
                          />
                          Ativo
                        </label>
                        <Button type="submit" intent="secondary">
                          Salvar
                        </Button>
                      </div>
                    </form>

                    <div className="space-y-1">
                      <p className="text-sm text-zinc-400">Link do QR Code</p>
                      <p className="text-sm text-zinc-200 break-all">{url}</p>
                    </div>

                    <form action={deleteCondominium}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button
                        type="submit"
                        intent="secondary"
                        className="border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      >
                        Excluir
                      </Button>
                    </form>
                  </div>

                  <div className="flex flex-col items-center justify-start gap-2">
                    <img src={qr} alt={`QR Code ${row.name}`} className="h-[180px] w-[180px] rounded bg-white p-2" />
                    <p className="text-xs text-zinc-400">{row.code}</p>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
