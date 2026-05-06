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
  if (!user) redirect("/login?next=/admin/equipe")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

export default async function AdminEquipePage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string; delete?: string }
}) {
  const ok = searchParams?.ok
  const error = searchParams?.error
  const deleteId = searchParams?.delete

  const { supabase } = await requireAdmin()

  async function createSalesMember(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const fullName = getString(formData, "full_name")
      const phone = getString(formData, "phone")
      const email = getString(formData, "email")
      const password = getString(formData, "password")

      if (!fullName || !phone || !email || !password) {
        redirect("/admin/equipe?error=Preencha todos os campos.")
      }

      if (password.length < 6) {
        redirect("/admin/equipe?error=A senha deve ter pelo menos 6 caracteres.")
      }

      const admin = createSupabaseAdminClient()
      
      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })

      if (authError) {
        redirect(`/admin/equipe?error=${encodeURIComponent(authError.message)}`)
      }

      // 2. Atualizar perfil para role 'client' (que agora é a área de vendas)
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          whatsapp: phone,
          role: "sales"
        })
        .eq("id", authData.user.id)

      if (profileError) {
        redirect(`/admin/equipe?error=${encodeURIComponent(profileError.message)}`)
      }

      redirect("/admin/equipe?ok=Equipe criada com sucesso.")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      redirect(`/admin/equipe?error=${encodeURIComponent(err instanceof Error ? err.message : "Erro desconhecido")}`)
    }
  }

  async function deleteMember(formData: FormData) {
    "use server"
    try {
      await requireAdmin()
      const userId = getString(formData, "user_id")
      if (!userId) redirect("/admin/equipe")

      const admin = createSupabaseAdminClient()
      const { error } = await admin.auth.admin.deleteUser(userId)
      
      if (error) {
        redirect(`/admin/equipe?error=${encodeURIComponent(error.message)}`)
      }

      redirect("/admin/equipe?ok=Membro removido.")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      redirect(`/admin/equipe?error=${encodeURIComponent(err instanceof Error ? err.message : "Erro ao excluir")}`)
    }
  }

  // Listar membros da equipe (role = client)
  const admin = createSupabaseAdminClient()
  const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const allUsers = usersRes.data.users ?? []

  const profilesRes = await supabase
    .from("profiles")
    .select("id,full_name,phone,referral_code,created_at")
    .eq("role", "sales")
    .order("created_at", { ascending: false })

  const profileList = profilesRes.data ?? []
  const userById = Object.fromEntries(allUsers.map(u => [u.id, u]))

  const equipe = profileList.map(p => ({
    ...p,
    email: userById[p.id]?.email ?? "—"
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Equipe de Vendas</h1>
          <p className="text-zinc-300">Cadastre e gerencie os membros da sua equipe de vendas.</p>
        </div>
        <Button asChild intent="ghost">
          <Link href="/admin">Voltar</Link>
        </Button>
      </div>

      {ok || error ? (
        <Card className="mt-6">
          {ok ? <p className="text-sm text-emerald-200">{ok}</p> : null}
          {error ? <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p> : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="text-lg font-semibold">Novo Membro</h2>
          <form action={createSalesMember} className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Nome Completo</label>
              <Input name="full_name" placeholder="Ex: João Silva" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Telefone / WhatsApp</label>
              <Input name="phone" placeholder="Ex: 12992239698" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">E-mail de Acesso</label>
              <Input name="email" type="email" placeholder="Ex: joao@email.com" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200">Senha de Acesso</label>
              <Input name="password" type="password" placeholder="Mínimo 6 caracteres" required />
            </div>
            <Button type="submit" className="w-full">Cadastrar Membro</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Membros Ativos</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {equipe.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      Nenhum membro cadastrado.
                    </td>
                  </tr>
                ) : (
                  equipe.map((member) => (
                    <tr key={member.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{member.full_name}</td>
                      <td className="px-4 py-3 text-zinc-300">{member.referral_code ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{member.email}</td>
                      <td className="px-4 py-3 text-zinc-300">{member.phone}</td>
                      <td className="px-4 py-3 text-right">
                        {deleteId === member.id ? (
                          <form action={deleteMember} className="flex justify-end gap-2">
                            <input type="hidden" name="user_id" value={member.id} />
                            <Button type="submit" intent="primary" className="bg-red-600 hover:bg-red-500 border-red-700" size="md">Confirmar</Button>
                            <Button asChild intent="ghost" size="md">
                              <Link href="/admin/equipe">Cancelar</Link>
                            </Button>
                          </form>
                        ) : (
                          <Button asChild intent="ghost" size="md">
                            <Link href={`/admin/equipe?delete=${member.id}`}>Excluir</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
