// Tanzania weather provider. TMA haina API ya umma ya bure, kwa hivyo
// tunatumia Open-Meteo (chanzo huru kinachochanganya data ya kimataifa
// na mifano ya kitaifa) kwa eneo la kifaa (lat/lon). Hii inampa AI
// ushauri sahihi zaidi wa umwagiliaji kwa kuzingatia mvua inayotarajiwa.

export type TmaWeather = {
  rain_probability: number | null; // 0-100 %
  rain_amount_mm: number | null; // jumla ya saa 24 zijazo
  summary: string | null;
  temp_c: number | null;
  humidity: number | null;
  raw: unknown;
};

export async function fetchTmaWeather(lat: number, lon: number): Promise<TmaWeather | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lon.toFixed(4));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation");
    url.searchParams.set("hourly", "precipitation,precipitation_probability");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "Africa/Dar_es_Salaam");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number };
      hourly?: { precipitation?: number[]; precipitation_probability?: number[] };
    };
    const probs = json.hourly?.precipitation_probability ?? [];
    const rains = json.hourly?.precipitation ?? [];
    const next24Prob = probs.length ? Math.max(...probs.slice(0, 24)) : null;
    const next24Mm = rains.length ? rains.slice(0, 24).reduce((a, b) => a + (b ?? 0), 0) : null;
    const summary =
      next24Prob != null
        ? `Uwezekano wa mvua saa 24 zijazo: ${Math.round(next24Prob)}% (≈ ${(next24Mm ?? 0).toFixed(1)} mm)`
        : null;
    return {
      rain_probability: next24Prob,
      rain_amount_mm: next24Mm,
      summary,
      temp_c: json.current?.temperature_2m ?? null,
      humidity: json.current?.relative_humidity_2m ?? null,
      raw: json,
    };
  } catch {
    return null;
  }
}
