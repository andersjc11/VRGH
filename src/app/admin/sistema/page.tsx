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
  if (!user) redirect("/login?next=/admin/sistema")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { userId: user.id }
}

function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  )
}

const BACKUP_BUCKET = "db-backups"

async function ensureBackupBucketExists(admin: any) {
  const listRes = await admin.storage.listBuckets()
  if (listRes.error) throw new Error(`Falha ao listar buckets: ${listRes.error.message}`)

  const bucket = (listRes.data ?? []).find((b: any) => b?.name === BACKUP_BUCKET)
  if (!bucket) {
    const createRes = await admin.storage.createBucket(BACKUP_BUCKET, { public: false })
    if (createRes.error) throw new Error(`Falha ao criar bucket de backup: ${createRes.error.message}`)
    return
  }

  if (bucket.public === true) {
    const updRes = await admin.storage.updateBucket(BACKUP_BUCKET, { public: false })
    if (updRes.error) throw new Error(`Falha ao atualizar bucket de backup: ${updRes.error.message}`)
  }
}

function formatBackupFileName(date: Date) {
  const iso = date.toISOString().replaceAll(":", "-").replaceAll(".", "-")
  return `backup-${iso}.json`
}

async function createBackup() {
  "use server"
  try {
    await requireAdmin()
    const admin = createSupabaseAdminClient()
    await ensureBackupBucketExists(admin)

    const tables = [
      "profiles",
      "equipments",
      "equipment_prices",
      "pricing_settings",
      "quotes",
      "quote_items",
      "reservations",
      "referrals",
      "cashback_transactions",
      "cashback_withdrawals"
    ] as const

    const results = await Promise.all(
      tables.map(async (t) => {
        const res = await admin.from(t).select("*")
        if (res.error) throw new Error(`Falha ao ler ${t}: ${res.error.message}`)
        return [t, res.data ?? []] as const
      })
    )

    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      tables: Object.fromEntries(results)
    }

    const fileName = formatBackupFileName(new Date())
    const path = `backups/${fileName}`
    const uploadRes = await admin.storage
      .from(BACKUP_BUCKET)
      .upload(path, Buffer.from(JSON.stringify(payload, null, 2), "utf-8"), {
        contentType: "application/json",
        upsert: false
      })

    if (uploadRes.error) {
      redirect(
        `/admin/sistema?error=${encodeURIComponent(
          `Falha ao salvar backup: ${uploadRes.error.message}`
        )}`
      )
    }

    const signedRes = await admin.storage.from(BACKUP_BUCKET).createSignedUrl(path, 60 * 60)
    if (signedRes.error || !signedRes.data?.signedUrl) {
      redirect(
        `/admin/sistema?error=${encodeURIComponent(
          `Backup criado, mas falhou ao gerar link: ${signedRes.error?.message ?? "erro desconhecido"}`
        )}`
      )
    }

    redirect(
      `/admin/sistema?ok=backup_created&backup=${encodeURIComponent(
        signedRes.data.signedUrl
      )}&backup_path=${encodeURIComponent(path)}`
    )
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao criar backup."
    redirect(`/admin/sistema?error=${encodeURIComponent(message)}`)
  }
}

async function getBackupLink(formData: FormData) {
  "use server"
  try {
    await requireAdmin()
    const name = String(formData.get("backup_name") ?? "").trim()
    if (!name) redirect("/admin/sistema?error=Backup%20inv%C3%A1lido")

    const admin = createSupabaseAdminClient()
    await ensureBackupBucketExists(admin)
    const path = `backups/${name}`
    const signedRes = await admin.storage.from(BACKUP_BUCKET).createSignedUrl(path, 60 * 60)
    if (signedRes.error || !signedRes.data?.signedUrl) {
      redirect(
        `/admin/sistema?error=${encodeURIComponent(
          `Falha ao gerar link: ${signedRes.error?.message ?? "erro desconhecido"}`
        )}`
      )
    }

    redirect(
      `/admin/sistema?ok=backup_created&backup=${encodeURIComponent(
        signedRes.data.signedUrl
      )}&backup_path=${encodeURIComponent(path)}`
    )
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha ao gerar link."
    redirect(`/admin/sistema?error=${encodeURIComponent(message)}`)
  }
}

async function clearDatabase(formData: FormData) {
  "use server"
  try {
    const { userId } = await requireAdmin()
    const confirm = String(formData.get("confirm") ?? "").trim()
    const deleteClientProfiles = String(formData.get("delete_client_profiles") ?? "") === "on"
    const deleteEquipments = String(formData.get("delete_equipments") ?? "") === "on"
    const deleteSettings = String(formData.get("delete_settings") ?? "") === "on"

    if (confirm !== "LIMPAR") {
      redirect("/admin/sistema?error=Confirma%C3%A7%C3%A3o%20inv%C3%A1lida.%20Digite%20LIMPAR.")
    }

    const admin = createSupabaseAdminClient()

    const deleteOrder = [
      "cashback_withdrawals",
      "cashback_transactions",
      "referrals",
      "reservations",
      "quote_items",
      "quotes"
    ] as const

    for (const table of deleteOrder) {
      const res = await admin.from(table).delete().not("id", "is", null)
      if (res.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao limpar ${table}: ${res.error.message}`
          )}`
        )
      }
    }

    if (deleteSettings) {
      const res = await admin.from("pricing_settings").delete().not("key", "is", null)
      if (res.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao limpar pricing_settings: ${res.error.message}`
          )}`
        )
      }
    }

    if (deleteEquipments) {
      const pricesRes = await admin.from("equipment_prices").delete().not("equipment_id", "is", null)
      if (pricesRes.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao limpar equipment_prices: ${pricesRes.error.message}`
          )}`
        )
      }
      const eqRes = await admin.from("equipments").delete().not("id", "is", null)
      if (eqRes.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao limpar equipments: ${eqRes.error.message}`
          )}`
        )
      }
    }

    if (deleteClientProfiles) {
      const res = await admin
        .from("profiles")
        .delete()
        .neq("id", userId)
        .neq("role", "admin")
      if (res.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao limpar profiles: ${res.error.message}`
          )}`
        )
      }
    }

    redirect("/admin/sistema?ok=cleared")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao limpar."
    redirect(`/admin/sistema?error=${encodeURIComponent(message)}`)
  }
}

function readFileText(formData: FormData, key: string) {
  const value = formData.get(key)
  if (!(value instanceof File)) return null
  return value.text()
}

async function restoreBackup(formData: FormData) {
  "use server"
  try {
    const { userId } = await requireAdmin()
    const confirm = String(formData.get("confirm_restore") ?? "").trim()
    if (confirm !== "RESTAURAR") {
      redirect(
        "/admin/sistema?error=Confirma%C3%A7%C3%A3o%20inv%C3%A1lida.%20Digite%20RESTAURAR."
      )
    }

    const text = await readFileText(formData, "backup_file")
    if (!text) redirect("/admin/sistema?error=Envie%20um%20arquivo%20de%20backup%20.json")

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      redirect("/admin/sistema?error=Arquivo%20de%20backup%20inv%C3%A1lido%20(JSON)")
    }

    const tables = parsed?.tables
    if (!tables || typeof tables !== "object") {
      redirect("/admin/sistema?error=Backup%20inv%C3%A1lido%3A%20campo%20tables%20ausente")
    }

    const admin = createSupabaseAdminClient()

    const clearOrder = [
      "cashback_withdrawals",
      "cashback_transactions",
      "referrals",
      "reservations",
      "quote_items",
      "quotes",
      "equipment_prices",
      "equipments",
      "pricing_settings"
    ] as const

    for (const table of clearOrder) {
      const res =
        table === "pricing_settings"
          ? await admin.from(table).delete().not("key", "is", null)
          : table === "equipment_prices"
            ? await admin.from(table).delete().not("equipment_id", "is", null)
            : await admin.from(table).delete().not("id", "is", null)
      if (res.error) {
        redirect(
          `/admin/sistema?error=${encodeURIComponent(
            `Falha ao preparar ${table}: ${res.error.message}`
          )}`
        )
      }
    }

    const clearProfilesRes = await admin
      .from("profiles")
      .delete()
      .neq("id", userId)
      .neq("role", "admin")
    if (clearProfilesRes.error) {
      redirect(
        `/admin/sistema?error=${encodeURIComponent(
          `Falha ao preparar profiles: ${clearProfilesRes.error.message}`
        )}`
      )
    }

    const upsert = async (table: string, rows: any[]) => {
      if (!Array.isArray(rows) || rows.length === 0) return
      const res =
        table === "pricing_settings"
          ? await admin.from(table).upsert(rows, { onConflict: "key" })
          : table === "equipment_prices"
            ? await admin.from(table).upsert(rows, { onConflict: "equipment_id" })
            : await admin.from(table).upsert(rows, { onConflict: "id" })
      if (res.error) {
        throw new Error(`Falha ao restaurar ${table}: ${res.error.message}`)
      }
    }

    const restoreOrder = [
      "profiles",
      "equipments",
      "equipment_prices",
      "pricing_settings",
      "quotes",
      "quote_items",
      "reservations",
      "referrals",
      "cashback_transactions",
      "cashback_withdrawals"
    ]

    for (const table of restoreOrder) {
      await upsert(table, tables[table] ?? [])
    }

    redirect("/admin/sistema?ok=restored")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao restaurar."
    redirect(`/admin/sistema?error=${encodeURIComponent(message)}`)
  }
}

export default async function AdminSistemaPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string; backup?: string; backup_path?: string }
}) {
  await requireAdmin()

  const ok = searchParams?.ok
  const error = searchParams?.error
  const backupUrl = searchParams?.backup ? safeDecodeURIComponent(searchParams.backup) : ""
  const backupPath = searchParams?.backup_path
    ? safeDecodeURIComponent(searchParams.backup_path)
    : ""

  const admin = createSupabaseAdminClient()
  await ensureBackupBucketExists(admin)
  const listRes = await admin.storage.from(BACKUP_BUCKET).list("backups", {
    limit: 20,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" }
  })
  const backups = (listRes.data ?? []).filter((b: any) => typeof b?.name === "string")

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sistema</h1>
        <p className="text-zinc-300">Manutenção do banco de dados (admin).</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild intent="secondary">
          <Link href="/admin">Voltar</Link>
        </Button>
      </div>

      {ok || error || backupUrl ? (
        <Card className="mt-6 space-y-2">
          {ok ? (
            <p className="text-sm text-emerald-200">
              {ok === "backup_created"
                ? "Backup criado com sucesso."
                : ok === "cleared"
                  ? "Banco limpo com sucesso."
                  : ok === "restored"
                    ? "Backup restaurado com sucesso."
                    : "OK."}
            </p>
          ) : null}
          {backupPath ? (
            <p className="text-xs text-zinc-400">Arquivo: {backupPath}</p>
          ) : null}
          {backupUrl ? (
            <a
              href={backupUrl}
              className="text-sm text-brand-200 underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Baixar backup (link temporário)
            </a>
          ) : null}
          {error ? (
            <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4">
        <Card>
          <p className="text-sm text-zinc-400">Backup</p>
          <p className="mt-2 text-sm text-zinc-300">
            Gera um arquivo JSON com as tabelas do sistema e salva no Storage.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <form action={createBackup}>
              <Button type="submit" intent="primary">
                Gerar backup
              </Button>
            </form>
          </div>

          {backups.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm text-zinc-200">Últimos backups</p>
              <div className="grid gap-2">
                {backups.map((b: any) => (
                  <div
                    key={b.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className="text-sm text-zinc-200">{b.name}</p>
                    <form action={getBackupLink}>
                      <input type="hidden" name="backup_name" value={b.name} />
                      <Button type="submit" intent="secondary" className="h-9 px-3 text-sm">
                        Gerar link
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">Restaurar backup</p>
          <p className="mt-2 text-sm text-zinc-300">
            Restaura tabelas a partir de um arquivo JSON. Isso substitui os dados atuais.
          </p>
          <form action={restoreBackup} className="mt-4 grid gap-3">
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Arquivo (.json)</p>
              <Input name="backup_file" type="file" accept="application/json,.json" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Confirmação (digite RESTAURAR)</p>
              <Input name="confirm_restore" placeholder="RESTAURAR" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" intent="primary">
                Restaurar
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <p className="text-sm text-zinc-400">Limpar banco</p>
          <p className="mt-2 text-sm text-zinc-300">
            Remove dados operacionais (pedidos, orçamentos, cashback). Opções abaixo ampliam o escopo.
          </p>
          <form action={clearDatabase} className="mt-4 grid gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                name="delete_client_profiles"
                className="h-4 w-4 accent-brand-500"
              />
              Excluir perfis de clientes (mantém admin)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                name="delete_equipments"
                className="h-4 w-4 accent-brand-500"
              />
              Excluir equipamentos e preços
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                name="delete_settings"
                className="h-4 w-4 accent-brand-500"
              />
              Excluir configurações (pricing_settings)
            </label>
            <div className="space-y-1">
              <p className="text-sm text-zinc-200">Confirmação (digite LIMPAR)</p>
              <Input name="confirm" placeholder="LIMPAR" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" intent="primary">
                Limpar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
