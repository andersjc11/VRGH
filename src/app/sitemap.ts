import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vrgh.com.br"
  const lastModified = new Date()

  return [
    {
      url: `${siteUrl}/`,
      lastModified
    },
    {
      url: `${siteUrl}/orcamento`,
      lastModified
    },
    {
      url: `${siteUrl}/cadastro`,
      lastModified
    },
    {
      url: `${siteUrl}/login`,
      lastModified
    }
  ]
}
