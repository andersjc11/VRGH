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

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function buildClientesUrl(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value)
  }
  const query = usp.toString()
  return query ? `/admin/clientes?${query}` : "/admin/clientes"
}

function makeClientesHref(q: string, userId: string, tab: "edit" | "password") {
  return buildClientesUrl({ q: q || undefined, user: userId, tab })
}

function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/clientes")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

export default async function AdminClientesPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string; q?: string; user?: string; tab?: string }
}) {
  const ok = searchParams?.ok
  const error = searchParams?.error
  const q = searchParams?.q ?? ""
  const selectedUserId = searchParams?.user ?? ""
  const tab = searchParams?.tab === "password" ? "password" : "edit"

  const { supabase } = await requireAdmin()

  async function saveClient(formData: FormData) {
    "use server"
    try {
      const { supabase } = await requireAdmin()
      const userId = getString(formData, "user_id")
      const q = getString(formData, "q")
      const tab = getString(formData, "tab") === "password" ? "password" : "edit"
      if (!userId) redirect(buildClientesUrl({ q, error: "ID inválido" }))

      const fullName = getString(formData, "full_name") || null
      const phone = getString(formData, "phone") || null
      const whatsapp = getString(formData, "whatsapp") || null
      const cpf = getString(formData, "cpf") || null
      const addressLine1 = getString(formData, "address_line1") || null
      const neighborhood = getString(formData, "neighborhood") || null
      const city = getString(formData, "city") || null
      const postalCode = getString(formData, "postal_code") || null

      const updateRes = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          whatsapp,
          cpf,
          address_line1: addressLine1,
          neighborhood,
          city,
          postal_code: postalCode
        })
        .eq("id", userId)

      if (updateRes.error) {
        redirect(
          buildClientesUrl({
            q,
            user: userId,
            tab,
            error: `Falha ao salvar: ${updateRes.error.message}`
          })
        )
      }

      redirect(buildClientesUrl({ q, user: userId, tab, ok: "1" }))
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
      const userId = getString(formData, "user_id")
      const q = getString(formData, "q")
      const tab = getString(formData, "tab") === "password" ? "password" : "edit"
      redirect(buildClientesUrl({ q, user: userId || undefined, tab, error: message }))
    }
  }

  async function setPassword(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const userId = getString(formData, "user_id")
      const password = getString(formData, "password")
      const q = getString(formData, "q")
      const tab = getString(formData, "tab") === "password" ? "password" : "edit"
      if (!userId) redirect(buildClientesUrl({ q, error: "ID inválido" }))
      if (!password) redirect(buildClientesUrl({ q, user: userId, tab: "password", error: "Digite uma senha" }))
      if (password.length < 6) {
        redirect(
          buildClientesUrl({
            q,
            user: userId,
            tab: "password",
            error: "A senha precisa ter pelo menos 6 caracteres"
          })
        )
      }

      const admin = createSupabaseAdminClient()
      const res = await admin.auth.admin.updateUserById(userId, { password })
      if (res.error) {
        redirect(
          buildClientesUrl({
            q,
            user: userId,
            tab: "password",
            error: `Falha ao alterar senha: ${res.error.message}`
          })
        )
      }

      redirect(buildClientesUrl({ q, user: userId, tab: "password", ok: "1" }))
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao alterar senha."
      const userId = getString(formData, "user_id")
      const q = getString(formData, "q")
      redirect(buildClientesUrl({ q, user: userId || undefined, tab: "password", error: message }))
    }
  }

  async function deleteClient(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const userId = getString(formData, "user_id")
      const q = getString(formData, "q")
      if (!userId) redirect(buildClientesUrl({ q, error: "ID inválido" }))

      const admin = createSupabaseAdminClient()
      const res = await admin.auth.admin.deleteUser(userId)
      if (res.error) {
        redirect(
          buildClientesUrl({ q, error: `Falha ao excluir: ${res.error.message}` })
        )
      }

      redirect(buildClientesUrl({ q, ok: "1" }))
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao excluir."
      const q = getString(formData, "q")
      redirect(buildClientesUrl({ q, error: message }))
    }
  }

  let users: any[] = []
  let profilesById: Record<string, any> = {}
  try {
    const admin = createSupabaseAdminClient()
    const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    users = usersRes.data.users ?? []

    const ids = users.map((u) => u.id).filter(Boolean)
    const profilesRes = ids.length
      ? await supabase
          .from("profiles")
          .select(
            "id,full_name,phone,whatsapp,cpf,address_line1,neighborhood,city,postal_code,role,created_at"
          )
          .in("id", ids)
      : { data: [], error: null as any }

    if (profilesRes.error) {
      redirect(
        `/admin/clientes?error=${encodeURIComponent(
          `Falha ao carregar perfis: ${profilesRes.error.message}`
        )}`
      )
    }

    profilesById = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.id, p]))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar clientes."
    redirect(`/admin/clientes?error=${encodeURIComponent(message)}`)
  }

  const rows = users
    .map((u) => {
      const profile = profilesById[u.id]
      return { user: u, profile }
    })
    .filter((x) => x.profile?.role === "client")
    .sort((a, b) => String(b.profile?.created_at ?? "").localeCompare(String(a.profile?.created_at ?? "")))

  const filteredRows = q
    ? rows.filter((r) => String(r.user?.email ?? "").toLowerCase().includes(q.toLowerCase()))
    : rows

  const selected = selectedUserId
    ? filteredRows.find((r) => r.user?.id === selectedUserId) ?? null
    : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-zinc-300">Gerencie contas de clientes: editar, alterar senha e excluir.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild intent="ghost">
            <Link href="/admin">Voltar</Link>
          </Button>
        </div>
      </div>

      {ok || error ? (
        <Card className="mt-6">
          {ok ? <p className="text-sm text-emerald-200">Atualizado com sucesso.</p> : null}
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <form method="get" className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Pesquisar por e-mail"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" intent="secondary">
            Pesquisar
          </Button>
          <Button asChild intent="ghost">
            <Link href="/admin/clientes">Limpar</Link>
          </Button>
        </div>
      </form>

      <Card className="mt-4 overflow-hidden">
        <div className="divide-y divide-white/10">
          {filteredRows.length === 0 ? (
            <div className="p-4">
              <p className="text-zinc-300">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            filteredRows.map(({ user, profile }) => {
              const isSelected = selectedUserId === user.id
              return (
                <div
                  key={user.id}
                  className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                    isSelected ? "bg-white/5" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.email ?? "—"}</p>
                    <p className="truncate text-sm text-zinc-400">
                      {profile?.full_name ?? "Sem nome"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
                    <Button asChild intent="secondary">
                      <Link href={makeClientesHref(q, user.id, "edit")}>Editar</Link>
                    </Button>
                    <Button asChild intent="secondary">
                      <Link href={makeClientesHref(q, user.id, "password")}>Senha</Link>
                    </Button>
                    <form action={deleteClient}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="q" value={q} />
                      <Button type="submit" intent="ghost">
                        Excluir
                      </Button>
                    </form>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {selected ? (
        <div className="mt-6 grid gap-3">
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{selected.user.email ?? selected.user.id}</p>
              <p className="truncate text-sm text-zinc-400">
                {selected.profile?.full_name ?? "Sem nome"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild intent={tab === "edit" ? "secondary" : "ghost"}>
                <Link href={makeClientesHref(q, selected.user.id, "edit")}>Editar</Link>
              </Button>
              <Button asChild intent={tab === "password" ? "secondary" : "ghost"}>
                <Link href={makeClientesHref(q, selected.user.id, "password")}>Senha</Link>
              </Button>
              <Button asChild intent="ghost">
                <Link href={buildClientesUrl({ q: q || undefined })}>Fechar</Link>
              </Button>
            </div>
          </Card>

          {tab === "edit" ? (
            <Card>
              <form action={saveClient} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="user_id" value={selected.user.id} />
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="tab" value="edit" />
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Nome</p>
                  <Input name="full_name" defaultValue={selected.profile?.full_name ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">CPF</p>
                  <Input name="cpf" defaultValue={selected.profile?.cpf ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">WhatsApp</p>
                  <Input name="whatsapp" defaultValue={selected.profile?.whatsapp ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Telefone</p>
                  <Input name="phone" defaultValue={selected.profile?.phone ?? ""} />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <p className="text-sm text-zinc-200">Endereço</p>
                  <Input name="address_line1" defaultValue={selected.profile?.address_line1 ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Bairro</p>
                  <Input name="neighborhood" defaultValue={selected.profile?.neighborhood ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Cidade</p>
                  <Input name="city" defaultValue={selected.profile?.city ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">CEP</p>
                  <Input name="postal_code" defaultValue={selected.profile?.postal_code ?? ""} />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <Button type="submit" intent="secondary">
                    Salvar dados
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card>
              <form action={setPassword} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="user_id" value={selected.user.id} />
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="tab" value="password" />
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Nova senha</p>
                  <Input name="password" type="password" autoComplete="new-password" />
                </div>
                <div className="sm:col-span-2 lg:col-span-2 flex items-end justify-end">
                  <Button type="submit" intent="secondary">
                    Alterar senha
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  )
}
