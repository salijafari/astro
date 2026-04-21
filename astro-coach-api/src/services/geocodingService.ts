/**
 * Google Maps Geocoding + Time Zone APIs (server-side, fetch only).
 */
const GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY ?? "";
const GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const TIMEZONE_BASE = "https://maps.googleapis.com/maps/api/timezone/json";

export type GeocodeResult = {
  lat: number;
  lng: number;
  timezone: string;
  formattedCity: string;
};

export type CitySearchResult = {
  displayName: string;
  lat: number;
  lng: number;
  timezone: string;
};

type GeocodeApiResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
};

type TimezoneApiResponse = {
  status?: string;
  timeZoneId?: string;
};

async function fetchTimezoneForCoords(lat: number, lng: number): Promise<string> {
  if (!GEOCODING_API_KEY) return "UTC";
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `${TIMEZONE_BASE}?location=${lat},${lng}&timestamp=${timestamp}&key=${encodeURIComponent(GEOCODING_API_KEY)}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as TimezoneApiResponse;
    if (data.status !== "OK" || !data.timeZoneId) return "UTC";
    return data.timeZoneId;
  } catch {
    return "UTC";
  }
}

/**
 * Resolve a city name to coordinates, formatted label, and IANA timezone via Google APIs.
 *
 * @param cityName Free-text location query (usually a city name).
 * @returns Resolved coordinates and timezone, or null if lookup fails or the API key is unset.
 */
async function geocodeCity(cityName: string): Promise<GeocodeResult | null> {
  try {
    if (!GEOCODING_API_KEY.trim()) return null;
    const geoUrl = `${GEOCODING_BASE}?address=${encodeURIComponent(cityName)}&key=${encodeURIComponent(GEOCODING_API_KEY)}`;
    const geoRes = await fetch(geoUrl);
    const geoData = (await geoRes.json()) as GeocodeApiResponse;
    if (geoData.status !== "OK" || !geoData.results?.length) return null;
    const first = geoData.results[0];
    if (!first) return null;
    const lat = first.geometry?.location?.lat;
    const lng = first.geometry?.location?.lng;
    const formattedCity = first.formatted_address ?? cityName;
    if (lat === undefined || lng === undefined) return null;

    const timezone = await fetchTimezoneForCoords(lat, lng);

    return { lat, lng, timezone, formattedCity };
  } catch (err: unknown) {
    console.error("[geocoding] geocodeCity failed:", err);
    return null;
  }
}

/**
 * Return up to 5 geocode matches with timezones for autocomplete-style search.
 *
 * @param query Partial city or address query (minimum 2 non-whitespace chars).
 */
async function searchCities(query: string): Promise<CitySearchResult[]> {
  try {
    const q = query.trim();
    if (q.length < 2) return [];
    if (!GEOCODING_API_KEY.trim()) return [];

    const geoUrl = `${GEOCODING_BASE}?address=${encodeURIComponent(q)}&key=${encodeURIComponent(GEOCODING_API_KEY)}`;
    const geoRes = await fetch(geoUrl);
    const geoData = (await geoRes.json()) as GeocodeApiResponse;
    if (geoData.status !== "OK" || !geoData.results?.length) return [];

    const slice = geoData.results.slice(0, 5);
    const withTz = await Promise.all(
      slice.map(async (result) => {
        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;
        const displayName = result.formatted_address ?? "";
        if (lat === undefined || lng === undefined) {
          return null;
        }
        let timezone = "UTC";
        try {
          timezone = await fetchTimezoneForCoords(lat, lng);
        } catch {
          timezone = "UTC";
        }
        return { displayName, lat, lng, timezone };
      }),
    );

    return withTz.filter((x): x is CitySearchResult => x !== null && x.displayName.length > 0);
  } catch (err: unknown) {
    console.error("[geocoding] searchCities failed:", err);
    return [];
  }
}

export { geocodeCity, searchCities };
