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
  searchParams?: { ok?: string; error?: string }
}) {
  const ok = searchParams?.ok
  const error = searchParams?.error

  const { supabase } = await requireAdmin()

  async function saveClient(formData: FormData) {
    "use server"
    try {
      const { supabase } = await requireAdmin()
      const userId = getString(formData, "user_id")
      if (!userId) redirect("/admin/clientes?error=ID%20inv%C3%A1lido")

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
          `/admin/clientes?error=${encodeURIComponent(
            `Falha ao salvar: ${updateRes.error.message}`
          )}`
        )
      }

      redirect("/admin/clientes?ok=1")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
      redirect(`/admin/clientes?error=${encodeURIComponent(message)}`)
    }
  }

  async function setPassword(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const userId = getString(formData, "user_id")
      const password = getString(formData, "password")
      if (!userId) redirect("/admin/clientes?error=ID%20inv%C3%A1lido")
      if (!password) redirect("/admin/clientes?error=Digite%20uma%20senha")
      if (password.length < 6) redirect("/admin/clientes?error=A%20senha%20precisa%20ter%20pelo%20menos%206%20caracteres")

      const admin = createSupabaseAdminClient()
      const res = await admin.auth.admin.updateUserById(userId, { password })
      if (res.error) {
        redirect(
          `/admin/clientes?error=${encodeURIComponent(
            `Falha ao alterar senha: ${res.error.message}`
          )}`
        )
      }

      redirect("/admin/clientes?ok=1")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao alterar senha."
      redirect(`/admin/clientes?error=${encodeURIComponent(message)}`)
    }
  }

  async function deleteClient(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const userId = getString(formData, "user_id")
      if (!userId) redirect("/admin/clientes?error=ID%20inv%C3%A1lido")

      const admin = createSupabaseAdminClient()
      const res = await admin.auth.admin.deleteUser(userId)
      if (res.error) {
        redirect(
          `/admin/clientes?error=${encodeURIComponent(
            `Falha ao excluir: ${res.error.message}`
          )}`
        )
      }

      redirect("/admin/clientes?ok=1")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message = err instanceof Error ? err.message : "Falha inesperada ao excluir."
      redirect(`/admin/clientes?error=${encodeURIComponent(message)}`)
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

      <div className="mt-8 grid gap-3">
        {rows.length === 0 ? (
          <Card>
            <p className="text-zinc-300">Nenhum cliente encontrado.</p>
          </Card>
        ) : (
          rows.map(({ user, profile }) => (
            <Card key={user.id} className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{profile?.full_name || user.email || user.id}</p>
                  <p className="text-sm text-zinc-400">{user.email ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={deleteClient}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <Button type="submit" intent="ghost">
                      Excluir
                    </Button>
                  </form>
                </div>
              </div>

              <form action={saveClient} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="user_id" value={user.id} />
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Nome</p>
                  <Input name="full_name" defaultValue={profile?.full_name ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">CPF</p>
                  <Input name="cpf" defaultValue={profile?.cpf ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">WhatsApp</p>
                  <Input name="whatsapp" defaultValue={profile?.whatsapp ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Telefone</p>
                  <Input name="phone" defaultValue={profile?.phone ?? ""} />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <p className="text-sm text-zinc-200">Endereço</p>
                  <Input name="address_line1" defaultValue={profile?.address_line1 ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Bairro</p>
                  <Input name="neighborhood" defaultValue={profile?.neighborhood ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">Cidade</p>
                  <Input name="city" defaultValue={profile?.city ?? ""} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-zinc-200">CEP</p>
                  <Input name="postal_code" defaultValue={profile?.postal_code ?? ""} />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <Button type="submit" intent="secondary">
                    Salvar dados
                  </Button>
                </div>
              </form>

              <form action={setPassword} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="user_id" value={user.id} />
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
          ))
        )}
      </div>
    </div>
  )
}
