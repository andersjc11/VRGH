import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"

export default async function AdminConfiguracoesPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/configuracoes")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")

  const settingsRes = await supabase
    .from("pricing_settings")
    .select("key,value_json,updated_at")
    .order("key", { ascending: true })

  const settings = settingsRes.data ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-zinc-300">
          Visualização inicial. Próxima etapa: formulário para editar e versionar.
        </p>
      </div>

      <div className="mt-8 grid gap-3">
        {settings.length === 0 ? (
          <Card>
            <p className="text-zinc-300">Nenhuma configuração encontrada.</p>
          </Card>
        ) : (
          settings.map((s: any) => (
            <Card key={s.key}>
              <p className="text-sm text-zinc-400">{s.key}</p>
              <pre className="mt-2 overflow-x-auto text-xs text-zinc-200">
                {JSON.stringify(s.value_json, null, 2)}
              </pre>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

