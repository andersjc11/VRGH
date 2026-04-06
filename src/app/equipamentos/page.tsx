import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/Card"

export const dynamic = "force-dynamic"

type EquipmentRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  video_url: string | null
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

export default async function EquipamentosPage() {
  const supabase = createSupabaseServerClient()
  const equipmentsResWithVideo = await supabase
    .from("equipments")
    .select("id,name,description,category,image_url,video_url")
    .eq("active", true)
    .order("created_at", { ascending: true })

  const equipmentsRes =
    equipmentsResWithVideo.error &&
    String((equipmentsResWithVideo.error as any)?.message ?? "")
      .toLowerCase()
      .includes('column "video_url" does not exist')
      ? await supabase
          .from("equipments")
          .select("id,name,description,category,image_url")
          .eq("active", true)
          .order("created_at", { ascending: true })
      : equipmentsResWithVideo

  const equipments = (equipmentsRes.data ?? []) as EquipmentRow[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Equipamentos</h1>
        <p className="text-zinc-300">
          Selecione itens para montar seu orçamento automático.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {equipments.length === 0 ? (
          <>
            <Card>
              <p className="text-sm text-zinc-400">Exemplo</p>
              <p className="mt-2 font-semibold">Console + TV 55&quot;</p>
              <p className="mt-1 text-sm text-zinc-300">
                Ideal para festas e eventos corporativos.
              </p>
            </Card>
            <Card>
              <p className="text-sm text-zinc-400">Exemplo</p>
              <p className="mt-2 font-semibold">PC Gamer + Monitor</p>
              <p className="mt-1 text-sm text-zinc-300">
                Setup completo com periféricos.
              </p>
            </Card>
            <Card>
              <p className="text-sm text-zinc-400">Exemplo</p>
              <p className="mt-2 font-semibold">Simulador</p>
              <p className="mt-1 text-sm text-zinc-300">
                Experiência premium para ativações.
              </p>
            </Card>
          </>
        ) : (
          equipments.map((eq) => (
            <Card key={eq.id}>
              <p className="text-sm text-zinc-400">
                {eq.category ?? "Equipamento"}
              </p>
              <p className="mt-2 font-semibold">{eq.name}</p>
              {eq.image_url ? (
                <img
                  src={eq.image_url}
                  alt={eq.name}
                  className="mt-3 h-44 w-full rounded-lg border border-white/10 bg-white/5 object-cover"
                  loading="lazy"
                />
              ) : null}
              <p className="mt-1 text-sm text-zinc-300">
                {eq.description ?? "—"}
              </p>
              {"video_url" in eq && eq.video_url && toVideoEmbedUrl(eq.video_url) ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <iframe
                    src={toVideoEmbedUrl(eq.video_url) as string}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    title={`Vídeo - ${eq.name}`}
                  />
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
