import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

function safeDecodeURIComponent(value: string | undefined) {
  if (!value) return ""
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isNextRedirectError(err: unknown) {
  const digest = (err as any)?.digest
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT")
}

function isMissingColumnError(err: unknown, column: string) {
  const message = (err as any)?.message
  if (typeof message !== "string") return false
  return message.toLowerCase().includes(`column "${column.toLowerCase()}" does not exist`)
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/admin/equipamentos")

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRes.data?.role !== "admin") redirect("/cliente")
  return { supabase }
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseMoneyToCents(raw: string) {
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim()
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

async function createEquipment(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()

    const name = getString(formData, "name")
    const category = getString(formData, "category") || null
    const description = getString(formData, "description") || null
    const imageUrl = getString(formData, "image_url") || null
    const videoUrl = getString(formData, "video_url") || null
    const active = getString(formData, "active") === "on"
    const priceCents = parseMoneyToCents(getString(formData, "price_per_hour"))
    const minHoursRaw = Number(getString(formData, "min_hours") || "1")
    const minHours = Number.isFinite(minHoursRaw) ? Math.max(1, Math.trunc(minHoursRaw)) : 1

    if (!name) redirect("/admin/equipamentos?error=Nome%20%C3%A9%20obrigat%C3%B3rio")
    if (priceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20inv%C3%A1lido")

    const insertRes = await supabase
      .from("equipments")
      .insert({
        name,
        category,
        description,
        image_url: imageUrl,
        video_url: videoUrl,
        active
      })
      .select("id")
      .single()

    if (insertRes.error) {
      if (isMissingColumnError(insertRes.error, "video_url")) {
        const fallbackInsertRes = await supabase
          .from("equipments")
          .insert({
            name,
            category,
            description,
            image_url: imageUrl,
            active
          })
          .select("id")
          .single()

        if (fallbackInsertRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao criar estação: ${fallbackInsertRes.error.message}`
            )}`
          )
        }

        const equipmentId = fallbackInsertRes.data.id as string
        const priceRes = await supabase
          .from("equipment_prices")
          .upsert(
            {
              equipment_id: equipmentId,
              price_per_hour_cents: priceCents,
              min_hours: minHours
            },
            { onConflict: "equipment_id" }
          )

        if (priceRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${priceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=created&error=${encodeURIComponent(
            "Vídeo ainda não está disponível no banco. Execute a migration 0004_add_equipment_video.sql no Supabase."
          )}`
        )
      }

      redirect(
        `/admin/equipamentos?error=${encodeURIComponent(
          `Falha ao criar estação: ${insertRes.error.message}`
        )}`
      )
    }

    const equipmentId = insertRes.data.id as string
    const priceRes = await supabase
      .from("equipment_prices")
      .upsert(
        {
          equipment_id: equipmentId,
          price_per_hour_cents: priceCents,
          min_hours: minHours
        },
        { onConflict: "equipment_id" }
      )

    if (priceRes.error) {
      redirect(
        `/admin/equipamentos?error=${encodeURIComponent(
          `Falha ao salvar preço: ${priceRes.error.message}`
        )}`
      )
    }

    redirect("/admin/equipamentos?ok=created")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
    redirect(`/admin/equipamentos?error=${encodeURIComponent(message)}`)
  }
}

async function updateEquipment(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()

    const id = getString(formData, "id")
    const name = getString(formData, "name")
    const category = getString(formData, "category") || null
    const description = getString(formData, "description") || null
    const imageUrl = getString(formData, "image_url") || null
    const videoUrl = getString(formData, "video_url") || null
    const active = getString(formData, "active") === "on"
    const priceCents = parseMoneyToCents(getString(formData, "price_per_hour"))
    const minHoursRaw = Number(getString(formData, "min_hours") || "1")
    const minHours = Number.isFinite(minHoursRaw) ? Math.max(1, Math.trunc(minHoursRaw)) : 1

    if (!id) redirect("/admin/equipamentos?error=ID%20inv%C3%A1lido")
    if (!name) redirect("/admin/equipamentos?error=Nome%20%C3%A9%20obrigat%C3%B3rio")
    if (priceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20inv%C3%A1lido")

    const updRes = await supabase
      .from("equipments")
      .update({
        name,
        category,
        description,
        image_url: imageUrl,
        video_url: videoUrl,
        active
      })
      .eq("id", id)

    if (updRes.error) {
      if (isMissingColumnError(updRes.error, "video_url")) {
        const fallbackUpdRes = await supabase
          .from("equipments")
          .update({
            name,
            category,
            description,
            image_url: imageUrl,
            active
          })
          .eq("id", id)

        if (fallbackUpdRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao atualizar estação: ${fallbackUpdRes.error.message}`
            )}`
          )
        }

        const priceRes = await supabase
          .from("equipment_prices")
          .upsert(
            {
              equipment_id: id,
              price_per_hour_cents: priceCents,
              min_hours: minHours
            },
            { onConflict: "equipment_id" }
          )

        if (priceRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${priceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=updated&error=${encodeURIComponent(
            "Vídeo ainda não está disponível no banco. Execute a migration 0004_add_equipment_video.sql no Supabase."
          )}`
        )
      }

      redirect(
        `/admin/equipamentos?error=${encodeURIComponent(
          `Falha ao atualizar estação: ${updRes.error.message}`
        )}`
      )
    }

    const priceRes = await supabase
      .from("equipment_prices")
      .upsert(
        {
          equipment_id: id,
          price_per_hour_cents: priceCents,
          min_hours: minHours
        },
        { onConflict: "equipment_id" }
      )

    if (priceRes.error) {
      redirect(
        `/admin/equipamentos?error=${encodeURIComponent(
          `Falha ao salvar preço: ${priceRes.error.message}`
        )}`
      )
    }

    redirect("/admin/equipamentos?ok=updated")
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : "Falha inesperada ao salvar."
    redirect(`/admin/equipamentos?error=${encodeURIComponent(message)}`)
  }
}

export default async function AdminEquipamentosPage({
  searchParams
}: {
  searchParams?: { ok?: string; error?: string; edit?: string; create?: string }
}) {
  async function deleteEquipment(formData: FormData) {
    "use server"
    try {
      const { supabase } = await requireAdmin()
      const id = getString(formData, "id")
      if (!id) redirect("/admin/equipamentos?error=ID%20inv%C3%A1lido")

      const delRes = await supabase.from("equipments").delete().eq("id", id)
      if (delRes.error) {
        redirect(
          `/admin/equipamentos?error=${encodeURIComponent(
            `Falha ao deletar: ${delRes.error.message}`
          )}`
        )
      }

      redirect("/admin/equipamentos?ok=deleted")
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      const message =
        err instanceof Error ? err.message : "Falha inesperada ao deletar."
      redirect(`/admin/equipamentos?error=${encodeURIComponent(message)}`)
    }
  }

  const { supabase } = await requireAdmin()

  const equipmentsResWithVideo = await supabase
    .from("equipments")
    .select("id,name,description,category,image_url,video_url,active,created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const equipmentsRes =
    equipmentsResWithVideo.error && isMissingColumnError(equipmentsResWithVideo.error, "video_url")
      ? await supabase
          .from("equipments")
          .select("id,name,description,category,image_url,active,created_at")
          .order("created_at", { ascending: false })
          .limit(50)
      : equipmentsResWithVideo

  const pricesRes = await supabase
    .from("equipment_prices")
    .select("equipment_id,price_per_hour_cents,min_hours")
    .order("created_at", { ascending: false })

  const priceByEquipmentId = Object.fromEntries(
    (pricesRes.data ?? []).map((p: any) => [
      p.equipment_id,
      {
        equipment_id: p.equipment_id,
        price_per_hour_cents: p.price_per_hour_cents,
        min_hours: p.min_hours
      }
    ])
  ) as Record<string, { price_per_hour_cents: number; min_hours: number }>

  const equipments = (equipmentsRes.data ?? []) as any[]
  const ok = searchParams?.ok
  const error = searchParams?.error
  const editId = searchParams?.edit
  const isCreating = Boolean(searchParams?.create)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Equipamentos</h1>
        <p className="text-zinc-300">
          Configure estações gamer: preço, descrição, imagem e vídeo.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild intent="secondary">
          <Link href="/admin">Voltar</Link>
        </Button>
        <Button asChild>
          <Link href={isCreating ? "/admin/equipamentos" : "/admin/equipamentos?create=1"}>
            {isCreating ? "Fechar nova estação" : "Nova estação"}
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-3">
        {equipmentsRes.error ? (
          <Card>
            <p className="text-sm text-red-300">
              {equipmentsRes.error.message}
            </p>
          </Card>
        ) : null}
        {ok || error ? (
          <Card>
            {ok ? <p className="text-sm text-emerald-200">Salvo com sucesso.</p> : null}
            {error ? (
              <p className="text-sm text-red-300">{safeDecodeURIComponent(error)}</p>
            ) : null}
          </Card>
        ) : null}
        {isCreating ? (
          <Card>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-zinc-400">Nova estação</p>
                <p className="mt-1 font-semibold">Criar estação gamer</p>
              </div>
              <Button asChild intent="secondary">
                <Link href="/admin/equipamentos">Cancelar</Link>
              </Button>
            </div>

            <form action={createEquipment} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200" htmlFor="new_name">
                  Nome
                </label>
                <Input id="new_name" name="name" required placeholder='Ex: Console + TV 55"' />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_category">
                  Categoria
                </label>
                <Input id="new_category" name="category" placeholder="Ex: Console" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_price">
                  Preço por hora (R$)
                </label>
                <Input
                  id="new_price"
                  name="price_per_hour"
                  type="text"
                  required
                  placeholder="250,00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_min_hours">
                  Mínimo (horas)
                </label>
                <Input
                  id="new_min_hours"
                  name="min_hours"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_image">
                  URL da imagem
                </label>
                <Input id="new_image" name="image_url" placeholder="https://..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200" htmlFor="new_video">
                  URL do vídeo (explicação)
                </label>
                <Input id="new_video" name="video_url" placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm text-zinc-200" htmlFor="new_desc">
                  Descrição
                </label>
                <textarea
                  id="new_desc"
                  name="description"
                  className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Descreva o que acompanha a estação..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-200 sm:col-span-2">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                Ativo
              </label>
              <div className="sm:col-span-2 flex items-center justify-end gap-2">
                <Button asChild intent="secondary">
                  <Link href="/admin/equipamentos">Cancelar</Link>
                </Button>
                <Button type="submit">Criar estação</Button>
              </div>
            </form>
          </Card>
        ) : null}

        {equipments.length === 0 ? (
          <Card>
            <p className="text-zinc-300">Nenhum equipamento cadastrado.</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-zinc-400">Estações cadastradas</p>
            <div className="mt-4 divide-y divide-white/10">
              {equipments.map((e: any) => {
                const isEditing = editId === e.id
                const price = priceByEquipmentId[e.id]
                return (
                  <div key={e.id} className="py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{e.name}</p>
                        <p className="text-sm text-zinc-400">
                          {e.category ?? "—"}
                          {typeof price?.price_per_hour_cents === "number"
                            ? ` • R$ ${(price.price_per_hour_cents / 100).toFixed(2).replace(".", ",")}/h`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild intent="secondary">
                          <Link href={isEditing ? "/admin/equipamentos" : `/admin/equipamentos?edit=${e.id}`}>
                            {isEditing ? "Fechar" : "Editar"}
                          </Link>
                        </Button>
                        <form action={deleteEquipment}>
                          <input type="hidden" name="id" value={e.id} />
                          <Button
                            type="submit"
                            intent="ghost"
                            className="text-red-300 hover:bg-red-500/10"
                          >
                            Deletar
                          </Button>
                        </form>
                      </div>
                    </div>

                    {isEditing ? (
                      <form action={updateEquipment} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={e.id} />
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-sm text-zinc-200" htmlFor={`name_${e.id}`}>
                            Nome
                          </label>
                          <Input id={`name_${e.id}`} name="name" required defaultValue={e.name ?? ""} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`cat_${e.id}`}>
                            Categoria
                          </label>
                          <Input id={`cat_${e.id}`} name="category" defaultValue={e.category ?? ""} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`price_${e.id}`}>
                            Preço por hora (R$)
                          </label>
                          <Input
                            id={`price_${e.id}`}
                            name="price_per_hour"
                            required
                            defaultValue={
                              price
                                ? (price.price_per_hour_cents / 100).toFixed(2).replace(".", ",")
                                : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`min_${e.id}`}>
                            Mínimo (horas)
                          </label>
                          <Input
                            id={`min_${e.id}`}
                            name="min_hours"
                            type="number"
                            min={1}
                            step={1}
                            defaultValue={price?.min_hours ?? 4}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`img_${e.id}`}>
                            URL da imagem
                          </label>
                          <Input id={`img_${e.id}`} name="image_url" defaultValue={e.image_url ?? ""} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-sm text-zinc-200" htmlFor={`vid_${e.id}`}>
                            URL do vídeo (explicação)
                          </label>
                          <Input id={`vid_${e.id}`} name="video_url" defaultValue={e.video_url ?? ""} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-sm text-zinc-200" htmlFor={`desc_${e.id}`}>
                            Descrição
                          </label>
                          <textarea
                            id={`desc_${e.id}`}
                            name="description"
                            defaultValue={e.description ?? ""}
                            className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-zinc-200 sm:col-span-2">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={Boolean(e.active)}
                            className="h-4 w-4 rounded border-white/20 bg-white/10"
                          />
                          Ativo
                        </label>
                        <div className="sm:col-span-2 flex items-center justify-end gap-2">
                          <Button asChild intent="secondary">
                            <Link href="/admin/equipamentos">Cancelar</Link>
                          </Button>
                          <Button type="submit">Salvar</Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
