import type { FlightAirport, FlightInformation } from "../../../lib/flight";

type Route = {
  callsign_icao?: string;
  callsign_iata?: string;
  airline?: { name?: string };
  origin?: unknown;
  destination?: unknown;
};
const cache = new Map<
  string,
  { flight: FlightInformation | null; expires: number }
>();

function airport(value: unknown): FlightAirport | null {
  if (!value || typeof value !== "object") return null;
  const fields = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof fields[key] === "string" ? fields[key].trim() || null : null;
  const iata = text("iata_code")?.toUpperCase();
  const icao = text("icao_code")?.toUpperCase();
  const code =
    iata && /^[A-Z]{3}$/.test(iata)
      ? iata
      : icao && /^[A-Z0-9]{4}$/.test(icao)
        ? icao
        : null;
  const name = text("name");
  const city = text("municipality");
  return name || city || code ? { name, city, code } : null;
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
    // Prefix-only matches can mistake rescue callsigns for foreign airlines.
    const airline =
      typeof matched?.airline?.name === "string" ? matched.airline.name : null;
    const origin = airport(matched?.origin);
    const destination = airport(matched?.destination);
    const flight =
      number || airline || origin || destination
        ? { number, airline, origin, destination }
        : null;
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(callsign, { flight, expires: Date.now() + 600000 });
    return Response.json(
      { flight },
      { headers: { "Cache-Control": "public,max-age=600" } },
    );
  } catch {
    return Response.json(
      { flight: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
