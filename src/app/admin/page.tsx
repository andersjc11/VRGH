import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profileRes.data?.role
  if (role !== "admin") redirect("/cliente")

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-zinc-300">Gestão de equipamentos, pedidos e cashback.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Cadastros</p>
          <p className="mt-2 font-semibold">Equipamentos</p>
          <p className="mt-1 text-sm text-zinc-300">
            CRUD, ativação/desativação e imagens.
          </p>
          <div className="mt-4">
            <Button asChild intent="secondary">
              <Link href="/admin/equipamentos">Abrir</Link>
            </Button>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Operação</p>
          <p className="mt-2 font-semibold">Pedidos</p>
          <p className="mt-1 text-sm text-zinc-300">
            Análise, confirmação, cancelamento e conclusão.
          </p>
          <div className="mt-4">
            <Button asChild intent="secondary">
              <Link href="/admin/pedidos">Abrir</Link>
            </Button>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Regras</p>
          <p className="mt-2 font-semibold">Taxas e descontos</p>
          <p className="mt-1 text-sm text-zinc-300">
            Configurar deslocamento, Pix, sinal e parcelas.
          </p>
          <div className="mt-4">
            <Button asChild intent="secondary">
              <Link href="/admin/configuracoes">Abrir</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

