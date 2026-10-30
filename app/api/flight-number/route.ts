type Route = {
  callsign_icao?: string;
  callsign_iata?: string;
  airline?: { name?: string };
};
type Flight = { number: string | null; airline: string | null };
const cache = new Map<string, { flight: Flight | null; expires: number }>();
const airlines = new Map<string, { name: string | null; expires: number }>();
async function airlineName(code: string) {
  const old = airlines.get(code);
  if (old && old.expires > Date.now()) return old.name;
  const response = await fetch(`https://api.adsbdb.com/v0/airline/${code}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    response?: { name?: string; icao?: string }[];
  };
  const match = Array.isArray(data.response)
    ? data.response.find((a) => a.icao === code)
    : null;
  const name = typeof match?.name === "string" ? match.name : null;
  if (airlines.size >= 100) airlines.delete(airlines.keys().next().value!);
  airlines.set(code, { name, expires: Date.now() + 3600000 });
  return name;
}
export async function GET(request: Request) {
  const callsign = (new URL(request.url).searchParams.get("callsign") || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}[A-Z0-9]{1,5}$/.test(callsign))
    return Response.json({ flight: null });
  const old = cache.get(callsign);
  if (old && old.expires > Date.now())
    return Response.json(
      { flight: old.flight },
      { headers: { "Cache-Control": "public,max-age=600" } },
    );
  try {
    const response = await fetch(
      `https://api.adsbdb.com/v0/callsign/${callsign}`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/json" },
      },
    );
    let route: Route | null = null;
    if (response.ok) {
      const data = (await response.json()) as {
        response?: { flightroute?: Route };
      };
      route = data.response?.flightroute ?? null;
    }
    const matched = route?.callsign_icao === callsign ? route : null;
    const number =
      typeof matched?.callsign_iata === "string" &&
      /^(?:[A-Z][A-Z0-9]|[0-9][A-Z])\d{1,4}$/.test(matched.callsign_iata)
        ? matched.callsign_iata
        : null;
    const airline =
      typeof matched?.airline?.name === "string"
        ? matched.airline.name
        : await airlineName(callsign.slice(0, 3)).catch(() => null);
    const flight = number || airline ? { number, airline } : null;
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(callsign, { flight, expires: Date.now() + 600000 });
    return Response.json(
      { flight },
      { headers: { "Cache-Control": "public,max-age=600" } },
    );
  } catch {
    const airline = await airlineName(callsign.slice(0, 3)).catch(() => null);
    return Response.json(
      { flight: airline ? { number: null, airline } : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
