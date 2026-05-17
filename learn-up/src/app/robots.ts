import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://learn-up-qmgx.onrender.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/settings"], // No indexar rutas de API ni configuraciones privadas
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
