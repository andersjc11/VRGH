import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function ClienteRedirectPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role === "sales" || profileRes.data?.role === "admin") {
    redirect("/vendas")
  }

  // Se for cliente comum logado por algum motivo, deslogar e mandar pra home
  await supabase.auth.signOut()
  redirect("/")
}
