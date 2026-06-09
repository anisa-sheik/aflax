import { CalculationMethod, Coordinates, PrayerTimes, SunnahTimes, HighLatitudeRule, Madhab } from "adhan";
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
  notify_prayers: PrayerKey[];
  notify_before_min: number;
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
  params.madhab = Madhab.Shafi;
  // Critical: at high latitudes (e.g. Scandinavia, UK, Canada) the sun does not
  // dip enough for true Fajr/Isha angles. Apply the recommended rule so the
  // times match trusted services like IslamicFinder / Aladhan.
  const absLat = Math.abs(s.latitude);
  if (absLat >= 48) {
    params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
  } else {
    params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
  }
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

// ---------- Notifications ----------

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}

const NOTIFIED_KEY = "deen.notified";
function loadNotified(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}"); } catch { return {}; }
}
function saveNotified(m: Record<string, true>) {
  // keep only today + yesterday
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 1);
  const c = cutoff.toISOString().slice(0, 10);
  const out: Record<string, true> = {};
  for (const k of Object.keys(m)) if (k.slice(0, 10) >= c) out[k] = true;
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(out));
}

function fire(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag: title, icon: "/favicon.ico", silent: false }); } catch {}
}

/** Schedules browser notifications for today's prayers based on settings. */
export function usePrayerNotifications(s: PrayerSettings | null | undefined) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!s || !s.notifications) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const tick = () => {
      const now = new Date();
      const t = computeTimes(s, now);
      if (!t) return;
      const fired = loadNotified();
      const before = Math.max(0, s.notify_before_min || 0) * 60_000;
      const enabled = new Set<PrayerKey>((s.notify_prayers ?? PRAYER_KEYS.filter(k => k !== "sunrise")) as PrayerKey[]);
      for (const k of PRAYER_KEYS) {
        if (k === "sunrise") continue;
        if (!enabled.has(k)) continue;
        const at = (t as any)[k] as Date;
        const reminderAt = new Date(at.getTime() - before);
        // fire reminder (if configured) once
        if (before > 0) {
          const rKey = `${reminderAt.toISOString().slice(0, 10)}:${k}:r`;
          if (!fired[rKey] && now >= reminderAt && now < at) {
            fire(`${PRAYER_LABELS[k]} in ${s.notify_before_min} min`, `at ${fmt(at)}`);
            fired[rKey] = true;
          }
        }
        const aKey = `${at.toISOString().slice(0, 10)}:${k}:a`;
        if (!fired[aKey] && now >= at && now.getTime() - at.getTime() < 5 * 60_000) {
          fire(`${PRAYER_LABELS[k]} • ${PRAYER_ARABIC[k]}`, `It's time for ${PRAYER_LABELS[k]} (${fmt(at)})`);
          fired[aKey] = true;
        }
      }
      saveNotified(fired);
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [s]);
}
