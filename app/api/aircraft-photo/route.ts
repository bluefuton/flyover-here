type Photo = { src: string; link: string; photographer: string };
const cache = new Map<string, { photo: Photo | null; expires: number }>();
export async function GET(request: Request) {
  const hex = new URL(request.url).searchParams.get("hex") || "";
  if (!/^[0-9a-f]{6}$/i.test(hex))
    return Response.json({ error: "Invalid aircraft ID." }, { status: 400 });
  const key = hex.toLowerCase();
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now())
    return Response.json(
      { photo: existing.photo },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  try {
    const response = await fetch(
      `https://api.planespotters.net/pub/photos/hex/${key}`,
      {
        headers: {
          "User-Agent":
            "FlyoverHere/1.0 (+https://github.com/bluefuton/flyover-here)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!response.ok) throw new Error("Photo service unavailable");
    const data = (await response.json()) as {
      photos?: {
        thumbnail_large?: { src?: string };
        thumbnail?: { src?: string };
        link?: string;
        photographer?: string;
      }[];
    };
    const p = data.photos?.[0];
    let photo: Photo | null = null;
    if (p) {
      const src = p.thumbnail_large?.src || p.thumbnail?.src;
      const link = p.link;
      if (src && link && typeof p.photographer === "string") {
        const imageUrl = new URL(src);
        const pageUrl = new URL(link);
        if (
          imageUrl.protocol === "https:" &&
          imageUrl.hostname === "t.plnspttrs.net" &&
          pageUrl.protocol === "https:" &&
          pageUrl.hostname === "www.planespotters.net"
        )
          photo = { src, link, photographer: p.photographer };
      }
    }
    if (cache.size >= 150) cache.delete(cache.keys().next().value!);
    cache.set(key, { photo, expires: Date.now() + 3600000 });
    return Response.json(
      { photo },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { photo: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
