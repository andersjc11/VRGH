import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { DadosClienteForm } from "./DadosClienteForm"

export default async function DadosClientePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const rawNext = searchParams?.next
  const next =
    typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : ""

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) {
    const nextParam = next ? `/cliente/dados?next=${encodeURIComponent(next)}` : "/cliente/dados"
    redirect(`/login?next=${encodeURIComponent(nextParam)}`)
  }

  const profileRes = await supabase
    .from("profiles")
    .select(
      "full_name,cpf,address_line1,address_number,address_line2,neighborhood,city,postal_code,whatsapp,phone"
    )
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRes.data as any

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Dados do cliente</h1>
          <p className="text-zinc-300">
            Estes dados são obrigatórios para formalizar a reserva e gerar o termo
            de contratação.
          </p>
        </div>
        <Button asChild intent="secondary">
          <Link href="/cliente">Voltar</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <DadosClienteForm
          initial={{
            full_name: profile?.full_name ?? null,
            cpf: profile?.cpf ?? null,
            address_line1: profile?.address_line1 ?? null,
            address_number: profile?.address_number ?? null,
            address_line2: profile?.address_line2 ?? null,
            neighborhood: profile?.neighborhood ?? null,
            city: profile?.city ?? null,
            postal_code: profile?.postal_code ?? null,
            whatsapp: profile?.whatsapp ?? null,
            phone: profile?.phone ?? null
          }}
          next={next || null}
        />
      </Card>
    </div>
  )
}

