export type Aircraft = {
  hex: string;
  latitude: number;
  longitude: number;
  callsign: string;
  registration: string | null;
  type: string | null;
  altitude: number;
  speed: number | null;
  track: number | null;
  verticalRate: number | null;
  distance: number;
  bearing: number;
  seen: number;
};
const rad = (n: number) => (n * Math.PI) / 180;
export function distanceKm(lat: number, lon: number, a: number, b: number) {
  const d =
    Math.sin(rad(a - lat) / 2) ** 2 +
    Math.cos(rad(lat)) * Math.cos(rad(a)) * Math.sin(rad(b - lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)));
}
export function nearestAircraft(
  rows: any[],
  lat: number,
  lon: number,
  radius = 25,
): Aircraft | null {
  const valid = rows
    .filter(
      (a) =>
        Number.isFinite(a.lat) &&
        Number.isFinite(a.lon) &&
        typeof a.alt_baro === "number" &&
        a.alt_baro > 0 &&
        Number.isFinite(a.seen_pos) &&
        a.seen_pos <= 30 &&
        /^[0-9a-f]{6}$/i.test(a.hex ?? ""),
    )
    .map((a) => {
      const y = Math.sin(rad(a.lon - lon)) * Math.cos(rad(a.lat));
      const x =
        Math.cos(rad(lat)) * Math.sin(rad(a.lat)) -
        Math.sin(rad(lat)) * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon - lon));
      return {
        hex: a.hex,
        latitude: a.lat,
        longitude: a.lon,
        callsign: String(a.flight || a.r || a.hex).trim(),
        registration: a.r || null,
        type: a.t || null,
        altitude: a.alt_baro,
        speed: typeof a.gs === "number" ? a.gs : null,
        track: typeof a.track === "number" ? a.track : null,
        verticalRate: typeof a.baro_rate === "number" ? a.baro_rate : null,
        distance: distanceKm(lat, lon, a.lat, a.lon),
        bearing: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
        seen: a.seen_pos,
      };
    })
    .filter((a) => a.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
  return valid[0] ?? null;
}
