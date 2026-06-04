import { CalculationMethod, Coordinates, PrayerTimes, SunnahTimes } from "adhan";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MethodKey = "MWL" | "ISNA" | "Umm Al-Qura" | "Egyptian" | "Karachi";
export const METHODS: MethodKey[] = ["MWL", "ISNA", "Umm Al-Qura", "Egyptian", "Karachi"];

export type PrayerSettings = {
  user_id: string;
  method: MethodKey;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  notifications: boolean;
  fajr_offset: number; dhuhr_offset: number; asr_offset: number;
  maghrib_offset: number; isha_offset: number;
};

function methodParams(m: MethodKey) {
  switch (m) {
    case "ISNA": return CalculationMethod.NorthAmerica();
    case "Umm Al-Qura": return CalculationMethod.UmmAlQura();
    case "Egyptian": return CalculationMethod.Egyptian();
    case "Karachi": return CalculationMethod.Karachi();
    default: return CalculationMethod.MuslimWorldLeague();
  }
}

export const PRAYER_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = typeof PRAYER_KEYS[number];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr",
  asr: "Asr", maghrib: "Maghrib", isha: "Isha",
};

export const PRAYER_ARABIC: Record<PrayerKey, string> = {
  fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر",
  asr: "العصر", maghrib: "المغرب", isha: "العشاء",
};

export function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function usePrayerSettings() {
  return useQuery({
    queryKey: ["prayer_settings"],
    queryFn: async (): Promise<PrayerSettings | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("prayer_settings").select("*").eq("user_id", user.id).maybeSingle();
      return data as any;
    },
  });
}

export function computeTimes(s: PrayerSettings | null | undefined, date = new Date()) {
  if (!s || s.latitude == null || s.longitude == null) return null;
  const coords = new Coordinates(s.latitude, s.longitude);
  const params = methodParams(s.method);
  params.adjustments = {
    fajr: s.fajr_offset, sunrise: 0, dhuhr: s.dhuhr_offset, asr: s.asr_offset,
    maghrib: s.maghrib_offset, isha: s.isha_offset,
  };
  const t = new PrayerTimes(coords, date, params);
  return {
    fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr,
    asr: t.asr, maghrib: t.maghrib, isha: t.isha,
    raw: t,
    sunnah: new SunnahTimes(t),
  };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function useNextPrayer(s: PrayerSettings | null | undefined) {
  const now = useNow(1000);
  return useMemo(() => {
    const today = computeTimes(s, now);
    if (!today) return null;
    const tomorrow = computeTimes(s, new Date(now.getTime() + 86400000));
    const order: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    let nextKey: PrayerKey = "fajr";
    let nextAt: Date = tomorrow ? tomorrow.fajr : today.fajr;
    let currentKey: PrayerKey = "isha";
    for (const k of order) {
      const at = (today as any)[k] as Date;
      if (at > now) { nextKey = k; nextAt = at; break; }
      currentKey = k;
    }
    const diff = Math.max(0, Math.floor((nextAt.getTime() - now.getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const sec = diff % 60;
    return {
      today, next: { key: nextKey, at: nextAt },
      current: { key: currentKey },
      countdown: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`,
    };
  }, [s, now]);
}

export async function detectLocation(): Promise<{ latitude: number; longitude: number; city: string | null; country: string | null; timezone: string }> {
  const pos = await new Promise<GeolocationPosition>((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: false })
  );
  const { latitude, longitude } = pos.coords;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let city: string | null = null, country: string | null = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
    const j = await r.json();
    city = j.address?.city || j.address?.town || j.address?.village || j.address?.state || null;
    country = j.address?.country || null;
  } catch {}
  return { latitude, longitude, city, country, timezone: tz };
}

export async function searchLocation(q: string): Promise<Array<{ display: string; latitude: number; longitude: number; city: string | null; country: string | null }>> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}&addressdetails=1`);
  const j = await r.json();
  return (j as any[]).map(x => ({
    display: x.display_name,
    latitude: +x.lat, longitude: +x.lon,
    city: x.address?.city || x.address?.town || x.address?.village || x.address?.state || null,
    country: x.address?.country || null,
  }));
}
