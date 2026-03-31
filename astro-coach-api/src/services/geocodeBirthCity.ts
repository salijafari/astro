import { find as findTimeZone } from "geo-tz";

/**
 * Geocodes a place name via Nominatim and resolves IANA timezone from coordinates (geo-tz).
 * Used when the client did not send lat/long or when backfilling from stored birth city.
 */
export async function geocodeBirthCity(city: string): Promise<{
  lat: number;
  lng: number;
  timezone: string;
} | null> {
  const q = city.trim();
  if (!q || q === "Unknown") return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const geoRes = await fetch(url.toString(), {
      headers: { "User-Agent": "AkhtarCoach/1.0 (geocodeBirthCity)" },
    });
    if (!geoRes.ok) return null;
    const geoData = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
    const first = geoData[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    const zones = findTimeZone(lat, lng);
    const timezone = zones[0] ?? "UTC";
    return { lat, lng, timezone };
  } catch (err: unknown) {
    console.warn("[geocodeBirthCity] failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
