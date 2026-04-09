import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

const EQUIPMENT_IMAGES_BUCKET = "equipment-images"

function safeDecodeURIComponent(value: string | undefined) {
  if (!value) return ""
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toVideoEmbedUrl(raw: string) {
  const url = raw.trim()
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = u.searchParams.get("v")
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
      if (u.pathname.startsWith("/embed/")) return url
    }

    if (host === "youtu.be") {
      const videoId = u.pathname.split("/").filter(Boolean)[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }

    if (host === "vimeo.com") {
      const videoId = u.pathname.split("/").filter(Boolean)[0]
      if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`
    }

    return url
  } catch {
    return url
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

function isEquipmentReferencedByQuoteItems(err: unknown) {
  const message = (err as any)?.message
  if (typeof message !== "string") return false
  const lower = message.toLowerCase()
  return (
    lower.includes("violates foreign key constraint") &&
    (lower.includes("quote_items") || lower.includes("quote_items_equipment_id_fkey"))
  )
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function getInt(formData: FormData, key: string, fallback: number) {
  const raw = getString(formData, key)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
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

async function uploadEquipmentImage(supabase: any, file: File) {
  const originalName = typeof file.name === "string" ? file.name : "image"
  const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "image"
  const objectPath = `equipments/${crypto.randomUUID()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  const uploadRes = await supabase.storage
    .from(EQUIPMENT_IMAGES_BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    })

  if (uploadRes.error) {
    redirect(
      `/admin/equipamentos?error=${encodeURIComponent(
        `Falha ao enviar imagem: ${uploadRes.error.message}`
      )}`
    )
  }

  const publicUrlRes = supabase.storage
    .from(EQUIPMENT_IMAGES_BUCKET)
    .getPublicUrl(objectPath)

  const publicUrl = publicUrlRes.data?.publicUrl
  if (!publicUrl) {
    redirect(
      `/admin/equipamentos?error=${encodeURIComponent(
        "Falha ao obter URL pública da imagem."
      )}`
    )
  }

  return publicUrl
}

async function createEquipment(formData: FormData) {
  "use server"
  try {
    const { supabase } = await requireAdmin()

    const name = getString(formData, "name")
    const category = getString(formData, "category") || null
    const description = getString(formData, "description") || null
    const imageUrlFromInput = getString(formData, "image_url") || null
    const videoUrl = getString(formData, "video_url") || null
    const active = getString(formData, "active") === "on"
    const imageFile = formData.get("image_file")
    const quantityTotalRaw = getInt(formData, "quantity_total", 1)
    const quantityTotal = Math.max(quantityTotalRaw, 0)
    const priceCents = parseMoneyToCents(getString(formData, "price_per_hour"))
    const dailyPriceRaw = getString(formData, "price_per_day")
    const dailyPriceCents = dailyPriceRaw ? parseMoneyToCents(dailyPriceRaw) : null
    const dayBlockPriceRaw = getString(formData, "price_per_day_block")
    const dayBlockPriceCents = dayBlockPriceRaw ? parseMoneyToCents(dayBlockPriceRaw) : null
    const discount2Raw = getString(formData, "discount_2_items_pct")
    const discount2Pct = Number(discount2Raw)
    const discount3Raw = getString(formData, "discount_3_items_pct")
    const discount3Pct = Number(discount3Raw)
    const minHoursRaw = Number(getString(formData, "min_hours") || "1")
    const minHours = Number.isFinite(minHoursRaw) ? Math.max(1, Math.trunc(minHoursRaw)) : 1

    if (!name) redirect("/admin/equipamentos?error=Nome%20%C3%A9%20obrigat%C3%B3rio")
    if (priceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20inv%C3%A1lido")
    if (dailyPriceRaw && dailyPriceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20di%C3%A1ria%20inv%C3%A1lido")
    if (dayBlockPriceRaw && dayBlockPriceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20di%C3%A1ria%20%28agenda%20bloqueada%29%20inv%C3%A1lido")
    if (discount2Raw && (!Number.isFinite(discount2Pct) || discount2Pct < 0 || discount2Pct > 100)) {
      redirect("/admin/equipamentos?error=Desconto%20%282%20itens%29%20inv%C3%A1lido")
    }
    if (discount3Raw && (!Number.isFinite(discount3Pct) || discount3Pct < 0 || discount3Pct > 100)) {
      redirect("/admin/equipamentos?error=Desconto%20%283%2B%20itens%29%20inv%C3%A1lido")
    }

    const imageUrl =
      imageFile instanceof File && imageFile.size > 0
        ? await uploadEquipmentImage(supabase, imageFile)
        : imageUrlFromInput

    const insertRes = await supabase
      .from("equipments")
      .insert({
        name,
        category,
        description,
        image_url: imageUrl,
        video_url: videoUrl,
        active,
        quantity_total: quantityTotal
      })
      .select("id")
      .single()

    if (insertRes.error) {
      if (
        isMissingColumnError(insertRes.error, "video_url") ||
        isMissingColumnError(insertRes.error, "quantity_total")
      ) {
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
              min_hours: minHours,
              price_per_day_cents: dailyPriceCents,
              price_per_day_block_cents: dayBlockPriceCents,
              discount_2_items_pct: discount2Raw ? Math.trunc(discount2Pct as number) : null,
              discount_3_items_pct: discount3Raw ? Math.trunc(discount3Pct as number) : null
            },
            { onConflict: "equipment_id" }
          )

        if (priceRes.error) {
          if (
            isMissingColumnError(priceRes.error, "price_per_day_cents") ||
            isMissingColumnError(priceRes.error, "price_per_day_block_cents") ||
            isMissingColumnError(priceRes.error, "discount_2_items_pct") ||
            isMissingColumnError(priceRes.error, "discount_3_items_pct")
          ) {
            const fallbackPriceRes = await supabase
              .from("equipment_prices")
              .upsert(
                {
                  equipment_id: equipmentId,
                  price_per_hour_cents: priceCents,
                  min_hours: minHours
                },
                { onConflict: "equipment_id" }
              )

            if (fallbackPriceRes.error) {
              redirect(
                `/admin/equipamentos?error=${encodeURIComponent(
                  `Falha ao salvar preço: ${fallbackPriceRes.error.message}`
                )}`
              )
            }

            redirect(
              `/admin/equipamentos?ok=created&error=${encodeURIComponent(
                "Alguns campos de preço ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
              )}`
            )
          }
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${priceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=created&error=${encodeURIComponent(
            "Alguns campos ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
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
          min_hours: minHours,
          price_per_day_cents: dailyPriceCents,
          price_per_day_block_cents: dayBlockPriceCents,
          discount_2_items_pct: discount2Raw ? Math.trunc(discount2Pct as number) : null,
          discount_3_items_pct: discount3Raw ? Math.trunc(discount3Pct as number) : null
        },
        { onConflict: "equipment_id" }
      )

    if (priceRes.error) {
      if (
        isMissingColumnError(priceRes.error, "price_per_day_cents") ||
        isMissingColumnError(priceRes.error, "price_per_day_block_cents") ||
        isMissingColumnError(priceRes.error, "discount_2_items_pct") ||
        isMissingColumnError(priceRes.error, "discount_3_items_pct")
      ) {
        const fallbackPriceRes = await supabase
          .from("equipment_prices")
          .upsert(
            {
              equipment_id: equipmentId,
              price_per_hour_cents: priceCents,
              min_hours: minHours
            },
            { onConflict: "equipment_id" }
          )

        if (fallbackPriceRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${fallbackPriceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=created&error=${encodeURIComponent(
            "Alguns campos de preço ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
          )}`
        )
      }
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
    const imageUrlFromInput = getString(formData, "image_url") || null
    const videoUrl = getString(formData, "video_url") || null
    const active = getString(formData, "active") === "on"
    const imageFile = formData.get("image_file")
    const quantityTotalRaw = getInt(formData, "quantity_total", 1)
    const quantityTotal = Math.max(quantityTotalRaw, 0)
    const priceCents = parseMoneyToCents(getString(formData, "price_per_hour"))
    const dailyPriceRaw = getString(formData, "price_per_day")
    const dailyPriceCents = dailyPriceRaw ? parseMoneyToCents(dailyPriceRaw) : null
    const dayBlockPriceRaw = getString(formData, "price_per_day_block")
    const dayBlockPriceCents = dayBlockPriceRaw ? parseMoneyToCents(dayBlockPriceRaw) : null
    const discount2Raw = getString(formData, "discount_2_items_pct")
    const discount2Pct = Number(discount2Raw)
    const discount3Raw = getString(formData, "discount_3_items_pct")
    const discount3Pct = Number(discount3Raw)
    const minHoursRaw = Number(getString(formData, "min_hours") || "1")
    const minHours = Number.isFinite(minHoursRaw) ? Math.max(1, Math.trunc(minHoursRaw)) : 1

    if (!id) redirect("/admin/equipamentos?error=ID%20inv%C3%A1lido")
    if (!name) redirect("/admin/equipamentos?error=Nome%20%C3%A9%20obrigat%C3%B3rio")
    if (priceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20inv%C3%A1lido")
    if (dailyPriceRaw && dailyPriceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20di%C3%A1ria%20inv%C3%A1lido")
    if (dayBlockPriceRaw && dayBlockPriceCents === null) redirect("/admin/equipamentos?error=Pre%C3%A7o%20di%C3%A1ria%20%28agenda%20bloqueada%29%20inv%C3%A1lido")
    if (discount2Raw && (!Number.isFinite(discount2Pct) || discount2Pct < 0 || discount2Pct > 100)) {
      redirect("/admin/equipamentos?error=Desconto%20%282%20itens%29%20inv%C3%A1lido")
    }
    if (discount3Raw && (!Number.isFinite(discount3Pct) || discount3Pct < 0 || discount3Pct > 100)) {
      redirect("/admin/equipamentos?error=Desconto%20%283%2B%20itens%29%20inv%C3%A1lido")
    }

    const imageUrl =
      imageFile instanceof File && imageFile.size > 0
        ? await uploadEquipmentImage(supabase, imageFile)
        : imageUrlFromInput

    const updRes = await supabase
      .from("equipments")
      .update({
        name,
        category,
        description,
        image_url: imageUrl,
        video_url: videoUrl,
        active,
        quantity_total: quantityTotal
      })
      .eq("id", id)

    if (updRes.error) {
      if (
        isMissingColumnError(updRes.error, "video_url") ||
        isMissingColumnError(updRes.error, "quantity_total")
      ) {
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
              min_hours: minHours,
              price_per_day_cents: dailyPriceCents,
              price_per_day_block_cents: dayBlockPriceCents,
              discount_2_items_pct: discount2Raw ? Math.trunc(discount2Pct as number) : null,
              discount_3_items_pct: discount3Raw ? Math.trunc(discount3Pct as number) : null
            },
            { onConflict: "equipment_id" }
          )

        if (priceRes.error) {
          if (
            isMissingColumnError(priceRes.error, "price_per_day_cents") ||
            isMissingColumnError(priceRes.error, "price_per_day_block_cents") ||
            isMissingColumnError(priceRes.error, "discount_2_items_pct") ||
            isMissingColumnError(priceRes.error, "discount_3_items_pct")
          ) {
            const fallbackPriceRes = await supabase
              .from("equipment_prices")
              .upsert(
                {
                  equipment_id: id,
                  price_per_hour_cents: priceCents,
                  min_hours: minHours
                },
                { onConflict: "equipment_id" }
              )

            if (fallbackPriceRes.error) {
              redirect(
                `/admin/equipamentos?error=${encodeURIComponent(
                  `Falha ao salvar preço: ${fallbackPriceRes.error.message}`
                )}`
              )
            }

            redirect(
              `/admin/equipamentos?ok=updated&error=${encodeURIComponent(
                "Alguns campos de preço ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
              )}`
            )
          }
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${priceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=updated&error=${encodeURIComponent(
            "Alguns campos ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
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
          min_hours: minHours,
          price_per_day_cents: dailyPriceCents,
          price_per_day_block_cents: dayBlockPriceCents,
          discount_2_items_pct: discount2Raw ? Math.trunc(discount2Pct as number) : null,
          discount_3_items_pct: discount3Raw ? Math.trunc(discount3Pct as number) : null
        },
        { onConflict: "equipment_id" }
      )

    if (priceRes.error) {
      if (
        isMissingColumnError(priceRes.error, "price_per_day_cents") ||
        isMissingColumnError(priceRes.error, "price_per_day_block_cents") ||
        isMissingColumnError(priceRes.error, "discount_2_items_pct") ||
        isMissingColumnError(priceRes.error, "discount_3_items_pct")
      ) {
        const fallbackPriceRes = await supabase
          .from("equipment_prices")
          .upsert(
            {
              equipment_id: id,
              price_per_hour_cents: priceCents,
              min_hours: minHours
            },
            { onConflict: "equipment_id" }
          )

        if (fallbackPriceRes.error) {
          redirect(
            `/admin/equipamentos?error=${encodeURIComponent(
              `Falha ao salvar preço: ${fallbackPriceRes.error.message}`
            )}`
          )
        }

        redirect(
          `/admin/equipamentos?ok=updated&error=${encodeURIComponent(
            "Alguns campos de preço ainda não estão disponíveis no banco. Execute as migrations pendentes no Supabase."
          )}`
        )
      }
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
  searchParams?: {
    ok?: string
    error?: string
    edit?: string
    create?: string
    availability_date?: string
    availability_time?: string
    availability_duration?: string
  }
}) {
  async function checkAvailability(formData: FormData) {
    "use server"
    const date = getString(formData, "availability_date")
    const time = getString(formData, "availability_time")
    const duration = getString(formData, "availability_duration")
    const qs = new URLSearchParams()
    if (date) qs.set("availability_date", date)
    if (time) qs.set("availability_time", time)
    if (duration) qs.set("availability_duration", duration)
    redirect(`/admin/equipamentos?${qs.toString()}`)
  }

  async function deleteEquipment(formData: FormData) {
    "use server"
    try {
      const { supabase } = await requireAdmin()
      const id = getString(formData, "id")
      if (!id) redirect("/admin/equipamentos?error=ID%20inv%C3%A1lido")

      const delRes = await supabase.from("equipments").delete().eq("id", id)
      if (delRes.error) {
        if (isEquipmentReferencedByQuoteItems(delRes.error)) {
          const disableRes = await supabase
            .from("equipments")
            .update({ active: false })
            .eq("id", id)

          if (disableRes.error) {
            redirect(
              `/admin/equipamentos?error=${encodeURIComponent(
                `Falha ao desativar: ${disableRes.error.message}`
              )}`
            )
          }

          redirect(
            `/admin/equipamentos?ok=disabled&error=${encodeURIComponent(
              "Este equipamento já foi usado em pedidos/orçamentos e não pode ser deletado. Ele foi desativado."
            )}`
          )
        }
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
    .select("id,name,description,category,image_url,video_url,active,quantity_total,created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const equipmentsRes =
    equipmentsResWithVideo.error && isMissingColumnError(equipmentsResWithVideo.error, "video_url")
      ? await supabase
          .from("equipments")
          .select("id,name,description,category,image_url,active,quantity_total,created_at")
          .order("created_at", { ascending: false })
          .limit(50)
      : equipmentsResWithVideo

  const pricesResWithProfiles = await supabase
    .from("equipment_prices")
    .select(
      "equipment_id,price_per_hour_cents,min_hours,price_per_day_cents,price_per_day_block_cents,discount_2_items_pct,discount_3_items_pct"
    )
    .order("created_at", { ascending: false })

  const pricesRes =
    pricesResWithProfiles.error &&
    (isMissingColumnError(pricesResWithProfiles.error, "price_per_day_cents") ||
      isMissingColumnError(pricesResWithProfiles.error, "discount_2_items_pct"))
      ? await supabase
          .from("equipment_prices")
          .select("equipment_id,price_per_hour_cents,min_hours")
          .order("created_at", { ascending: false })
      : pricesResWithProfiles

  const priceByEquipmentId = Object.fromEntries(
    (pricesRes.data ?? []).map((p: any) => [
      p.equipment_id,
      {
        equipment_id: p.equipment_id,
        price_per_hour_cents: p.price_per_hour_cents,
        min_hours: p.min_hours,
        price_per_day_cents: typeof p.price_per_day_cents === "number" ? p.price_per_day_cents : null,
        price_per_day_block_cents:
          typeof p.price_per_day_block_cents === "number" ? p.price_per_day_block_cents : null,
        discount_2_items_pct:
          typeof p.discount_2_items_pct === "number" ? p.discount_2_items_pct : null,
        discount_3_items_pct:
          typeof p.discount_3_items_pct === "number" ? p.discount_3_items_pct : null
      }
    ])
  ) as Record<
    string,
    {
      price_per_hour_cents: number
      min_hours: number
      price_per_day_cents?: number | null
      price_per_day_block_cents?: number | null
      discount_2_items_pct?: number | null
      discount_3_items_pct?: number | null
    }
  >

  const equipments = (equipmentsRes.data ?? []) as any[]
  const ok = searchParams?.ok
  const error = searchParams?.error
  const editId = searchParams?.edit
  const isCreating = Boolean(searchParams?.create)
  const availabilityDate = typeof searchParams?.availability_date === "string" ? searchParams.availability_date.trim() : ""
  const availabilityTime = typeof searchParams?.availability_time === "string" ? searchParams.availability_time.trim() : ""
  const availabilityDuration = (() => {
    const raw = typeof searchParams?.availability_duration === "string" ? searchParams.availability_duration.trim() : ""
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 4
  })()

  const availabilityRes =
    availabilityDate && availabilityTime && availabilityDuration > 0
      ? await supabase.rpc("get_equipment_availability", {
          event_date: availabilityDate,
          start_time: availabilityTime,
          duration_hours: availabilityDuration
        })
      : null

  const availabilityError =
    availabilityRes?.error?.message &&
    availabilityRes.error.message.toLowerCase().includes("get_equipment_availability") &&
    availabilityRes.error.message.toLowerCase().includes("does not exist")
      ? "Disponibilidade ainda não está configurada no banco. Execute a migration 0014_equipments_inventory_and_availability.sql no Supabase."
      : availabilityRes?.error?.message ?? null

  const availabilityByEquipmentId = Object.fromEntries(
    ((availabilityRes?.data ?? []) as any[])
      .filter((r) => typeof r?.equipment_id === "string")
      .map((r) => [
        r.equipment_id,
        {
          total: typeof r?.total_qty === "number" ? r.total_qty : 1,
          reserved: typeof r?.reserved_qty === "number" ? r.reserved_qty : 0,
          available: typeof r?.available_qty === "number" ? r.available_qty : 0
        }
      ])
  ) as Record<string, { total: number; reserved: number; available: number }>

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
        <Card>
          <p className="text-sm text-zinc-400">Disponibilidade</p>
          <form action={checkAvailability} className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-zinc-200" htmlFor="avail_date">
                Data
              </label>
              <Input
                id="avail_date"
                name="availability_date"
                type="date"
                defaultValue={availabilityDate || ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200" htmlFor="avail_time">
                Horário
              </label>
              <Input
                id="avail_time"
                name="availability_time"
                type="time"
                defaultValue={availabilityTime || ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-200" htmlFor="avail_duration">
                Duração (horas)
              </label>
              <Input
                id="avail_duration"
                name="availability_duration"
                type="number"
                min={1}
                step={1}
                defaultValue={availabilityDuration}
              />
            </div>
            <div className="sm:col-span-3 flex items-center justify-end">
              <Button type="submit">Checar</Button>
            </div>
          </form>
          {availabilityError ? (
            <p className="mt-3 text-sm text-red-300">{availabilityError}</p>
          ) : availabilityRes ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-300">
                    <th className="py-2 pr-4">Equipamento</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Reservado</th>
                    <th className="py-2 pr-4">Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  {equipments
                    .filter((e) => Boolean(e.active))
                    .map((e) => {
                      const row = availabilityByEquipmentId[e.id]
                      if (!row) return null
                      return (
                        <tr key={e.id} className="border-b border-white/5 text-zinc-100">
                          <td className="py-2 pr-4">{e.name}</td>
                          <td className="py-2 pr-4">{row.total}</td>
                          <td className="py-2 pr-4">{row.reserved}</td>
                          <td className="py-2 pr-4">{row.available}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
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

            <form
              action={createEquipment}
              encType="multipart/form-data"
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
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
                <label className="text-sm text-zinc-200" htmlFor="new_price_day">
                  Preço por diária (8h) (R$)
                </label>
                <Input
                  id="new_price_day"
                  name="price_per_day"
                  type="text"
                  placeholder="1.200,00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_price_day_block">
                  Preço diária (agenda bloqueada) (R$)
                </label>
                <Input
                  id="new_price_day_block"
                  name="price_per_day_block"
                  type="text"
                  placeholder="1.500,00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_discount_2">
                  Desconto (2 itens) (%)
                </label>
                <Input
                  id="new_discount_2"
                  name="discount_2_items_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_discount_3">
                  Desconto (3+ itens) (%)
                </label>
                <Input
                  id="new_discount_3"
                  name="discount_3_items_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="25"
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
                <label className="text-sm text-zinc-200" htmlFor="new_qty">
                  Quantidade disponível
                </label>
                <Input
                  id="new_qty"
                  name="quantity_total"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_image_file">
                  Imagem (upload)
                </label>
                <Input id="new_image_file" name="image_file" type="file" accept="image/*" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-200" htmlFor="new_image">
                  URL da imagem (opcional)
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
                const hasImage = typeof e.image_url === "string" && e.image_url.trim().length > 0
                const hasVideo =
                  "video_url" in e &&
                  typeof e.video_url === "string" &&
                  e.video_url.trim().length > 0
                const qtyTotal = typeof (e as any)?.quantity_total === "number" ? (e as any).quantity_total : 1
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
                          {typeof price?.price_per_day_cents === "number"
                            ? ` • R$ ${(price.price_per_day_cents / 100).toFixed(2).replace(".", ",")}/diária`
                            : ""}
                          {typeof price?.price_per_day_block_cents === "number"
                            ? ` • R$ ${(price.price_per_day_block_cents / 100).toFixed(2).replace(".", ",")}/diária (agenda)`
                            : ""}
                          {typeof price?.discount_2_items_pct === "number"
                            ? ` • Desc(2): ${Math.trunc(price.discount_2_items_pct)}%`
                            : ""}
                          {typeof price?.discount_3_items_pct === "number"
                            ? ` • Desc(3+): ${Math.trunc(price.discount_3_items_pct)}%`
                            : ""}
                          {` • Estoque: ${qtyTotal}`}
                          {hasImage ? " • Imagem" : ""}
                          {hasVideo ? " • Vídeo" : ""}
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
                      <form
                        action={updateEquipment}
                        encType="multipart/form-data"
                        className="mt-4 grid gap-4 sm:grid-cols-2"
                      >
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
                          <label className="text-sm text-zinc-200" htmlFor={`price_day_${e.id}`}>
                            Preço por diária (8h) (R$)
                          </label>
                          <Input
                            id={`price_day_${e.id}`}
                            name="price_per_day"
                            defaultValue={
                              typeof price?.price_per_day_cents === "number"
                                ? (price.price_per_day_cents / 100).toFixed(2).replace(".", ",")
                                : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`price_day_block_${e.id}`}>
                            Preço diária (agenda bloqueada) (R$)
                          </label>
                          <Input
                            id={`price_day_block_${e.id}`}
                            name="price_per_day_block"
                            defaultValue={
                              typeof price?.price_per_day_block_cents === "number"
                                ? (price.price_per_day_block_cents / 100).toFixed(2).replace(".", ",")
                                : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`disc2_${e.id}`}>
                            Desconto (2 itens) (%)
                          </label>
                          <Input
                            id={`disc2_${e.id}`}
                            name="discount_2_items_pct"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={typeof price?.discount_2_items_pct === "number" ? price.discount_2_items_pct : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`disc3_${e.id}`}>
                            Desconto (3+ itens) (%)
                          </label>
                          <Input
                            id={`disc3_${e.id}`}
                            name="discount_3_items_pct"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={typeof price?.discount_3_items_pct === "number" ? price.discount_3_items_pct : ""}
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
                          <label className="text-sm text-zinc-200" htmlFor={`qty_${e.id}`}>
                            Quantidade disponível
                          </label>
                          <Input
                            id={`qty_${e.id}`}
                            name="quantity_total"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={qtyTotal}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`img_file_${e.id}`}>
                            Imagem (upload)
                          </label>
                          <Input id={`img_file_${e.id}`} name="image_file" type="file" accept="image/*" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-200" htmlFor={`img_${e.id}`}>
                            URL da imagem (opcional)
                          </label>
                          <Input id={`img_${e.id}`} name="image_url" defaultValue={e.image_url ?? ""} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-sm text-zinc-200" htmlFor={`vid_${e.id}`}>
                            URL do vídeo (explicação)
                          </label>
                          <Input id={`vid_${e.id}`} name="video_url" defaultValue={e.video_url ?? ""} />
                        </div>
                        {hasImage ? (
                          <div className="space-y-2 sm:col-span-2">
                            <p className="text-sm text-zinc-200">Prévia da imagem</p>
                            <img
                              src={e.image_url}
                              alt={e.name}
                              className="h-44 w-full rounded-lg border border-white/10 bg-white/5 object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        {hasVideo && toVideoEmbedUrl(e.video_url) ? (
                          <div className="space-y-2 sm:col-span-2">
                            <p className="text-sm text-zinc-200">Prévia do vídeo</p>
                            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                              <iframe
                                src={toVideoEmbedUrl(e.video_url) as string}
                                className="aspect-video w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                loading="lazy"
                                title={`Vídeo - ${e.name}`}
                              />
                            </div>
                          </div>
                        ) : null}
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
