export function locationOverride(
  search: string,
):
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "valid"; position: { lat: number; lon: number } } {
  const params = new URLSearchParams(search);
  if (!params.has("lat") && !params.has("lon")) return { status: "absent" };
  const latitude = params.get("lat")?.trim();
  const longitude = params.get("lon")?.trim();
  if (!latitude || !longitude) return { status: "invalid" };
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return { status: "invalid" };
  return { status: "valid", position: { lat, lon } };
}
