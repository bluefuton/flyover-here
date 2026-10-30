import { nearestAircraft } from "../../../lib/aircraft";
type Snapshot = { ac: any[]; fetchedAt: number };
const snapshots = new Map<string, Snapshot>();
const pending = new Map<string, Promise<Snapshot>>();
class FeedError extends Error {
  constructor(
    public kind: string,
    public retryAfter = 30,
  ) {
    super(kind);
  }
}
function retrySeconds(value: string | null) {
  if (!value) return 30;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(delay)
    ? Math.min(300, Math.max(15, Math.ceil(delay)))
    : 30;
}
async function snapshot(lat: number, lon: number, radius: number) {
  const path = `${lat.toFixed(4)}/${lon.toFixed(4)}/${Math.ceil(radius / 1.852)}`;
  const old = snapshots.get(path);
  if (old && Date.now() - old.fetchedAt < 10000) return old;
  const existing = pending.get(path);
  if (existing) return existing;
  const task = (async () => {
    const response = await fetch(`https://api.adsb.lol/v2/point/${path}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (response.status === 429)
      throw new FeedError(
        "rate_limited",
        retrySeconds(response.headers.get("Retry-After")),
      );
    if (!response.ok)
      throw new FeedError(
        "unavailable",
        retrySeconds(response.headers.get("Retry-After")),
      );
    const data = (await response.json()) as { ac?: unknown };
    if (!Array.isArray(data.ac)) throw new FeedError("unavailable");
    const result = { ac: data.ac, fetchedAt: Date.now() };
    if (snapshots.size >= 40) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(path, result);
    return result;
  })();
  pending.set(path, task);
  try {
    return await task;
  } finally {
    pending.delete(path);
  }
}
export async function POST(request: Request) {
  let body: { lat: number; lon: number; radius: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return Response.json({ error: "Invalid request." }, { status: 400 });
  const { lat, lon, radius } = body;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    ![5, 10, 25, 50, 100].includes(radius)
  )
    return Response.json(
      { error: "Invalid location or range." },
      { status: 400 },
    );
  try {
    const data = await snapshot(lat, lon, radius);
    const age = (Date.now() - data.fetchedAt) / 1000;
    const rows = data.ac.map((a) => ({
      ...a,
      seen_pos: typeof a.seen_pos === "number" ? a.seen_pos + age : a.seen_pos,
    }));
    return Response.json(
      {
        aircraft: nearestAircraft(rows, lat, lon, radius),
        updatedAt: data.fetchedAt,
        source: "adsb.lol",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const rateLimited =
      error instanceof FeedError && error.kind === "rate_limited";
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    const retryAfter = error instanceof FeedError ? error.retryAfter : 30;
    const message = rateLimited
      ? "The flight data service is limiting requests. We’re giving it a moment."
      : timeout
        ? "The flight data service took too long to respond."
        : "The flight data service is temporarily unavailable.";
    return Response.json(
      {
        error: message,
        kind: rateLimited
          ? "rate_limited"
          : timeout
            ? "timeout"
            : "unavailable",
        retryAfter,
      },
      {
        status: rateLimited ? 429 : timeout ? 504 : 503,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
