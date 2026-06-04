import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Check, Clock, X, MapPin, Search, Locate, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  METHODS, MethodKey, PRAYER_KEYS, PRAYER_LABELS, PRAYER_ARABIC,
  usePrayerSettings, useNextPrayer, computeTimes, fmt,
  detectLocation, searchLocation, PrayerKey,
} from "@/lib/prayer-times";

export const Route = createFileRoute("/_authenticated/prayer")({
  component: PrayerScreen,
});

const LOGGABLE: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
function todayISO() { return new Date().toISOString().slice(0, 10); }

function PrayerScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"today" | "qibla" | "settings">("today");
  const [heading, setHeading] = useState<number | null>(null);
  const settingsQ = usePrayerSettings();
  const np = useNextPrayer(settingsQ.data);

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const a = (e as any).webkitCompassHeading ?? e.alpha;
      if (typeof a === "number") setHeading(a);
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  const logsQ = useQuery({
    queryKey: ["prayer_logs", todayISO()],
    queryFn: async () => (await supabase.from("prayer_logs").select("*").eq("prayer_date", todayISO())).data ?? [],
  });

  const setStatus = useMutation({
    mutationFn: async ({ key, status }: { key: string; status: "on_time" | "late" | "missed" }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const exists = (logsQ.data ?? []).find((l: any) => l.prayer_name === key);
      if (exists) await supabase.from("prayer_logs").update({ status }).eq("id", exists.id);
      else await supabase.from("prayer_logs").insert({ user_id: user!.id, prayer_name: key, prayer_date: todayISO(), status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prayer_logs"] }),
  });

  const clear = useMutation({
    mutationFn: async (key: string) => {
      const exists = (logsQ.data ?? []).find((l: any) => l.prayer_name === key);
      if (exists) await supabase.from("prayer_logs").delete().eq("id", exists.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prayer_logs"] }),
  });

  // Qibla bearing from coords
  const qiblaBearing = useMemo(() => {
    const s = settingsQ.data;
    if (!s?.latitude || !s?.longitude) return 124;
    const φ1 = s.latitude * Math.PI / 180, λ1 = s.longitude * Math.PI / 180;
    const φ2 = 21.4225 * Math.PI / 180, λ2 = 39.8262 * Math.PI / 180;
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }, [settingsQ.data]);
  const needle = heading == null ? qiblaBearing : qiblaBearing - heading;

  const hasLocation = settingsQ.data?.latitude != null && settingsQ.data?.longitude != null;

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Prayer</p>
        <h1 className="mt-1 text-2xl font-semibold">Salah</h1>
        {settingsQ.data?.city && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {settingsQ.data.city}{settingsQ.data.country ? `, ${settingsQ.data.country}` : ""}
          </p>
        )}
      </header>

      <div className="flex rounded-full bg-surface p-1 text-sm">
        {(["today", "qibla", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize transition ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "today" && (
        <>
          {!hasLocation && (
            <div className="glass-card rounded-2xl p-4 text-sm">
              <p className="font-semibold">Set your location</p>
              <p className="mt-1 text-xs text-muted-foreground">Prayer times need your coordinates. Open Settings to detect or enter your city.</p>
              <button onClick={() => setTab("settings")} className="mt-3 h-9 px-4 rounded-xl hero-gradient text-xs font-semibold">Go to settings</button>
            </div>
          )}
          {hasLocation && np && (
            <div className="hero-gradient rounded-2xl p-4 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest opacity-70">Next</p>
              <div className="mt-1 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold">{PRAYER_LABELS[np.next.key]}</p>
                  <p className="text-sm opacity-80">at {fmt(np.next.at)}</p>
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums">{np.countdown}</p>
              </div>
            </div>
          )}
          <section className="space-y-2">
            {PRAYER_KEYS.map((k) => {
              const t = np?.today?.[k];
              const log = (logsQ.data ?? []).find((l: any) => l.prayer_name === k) as any;
              const status = log?.status;
              const isNext = np?.next.key === k;
              const isCurrent = np?.current.key === k;
              return (
                <div key={k} className={`glass-card rounded-2xl p-4 ${isNext ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-2xl ${isCurrent ? "bg-primary text-primary-foreground" : "bg-surface text-primary"}`}>
                      <span className="text-lg">{PRAYER_ARABIC[k].slice(0, 1)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{PRAYER_LABELS[k]} {isNext && <span className="ml-1 text-[10px] uppercase text-primary">Next</span>}</p>
                      <p className="text-xs text-muted-foreground">{PRAYER_ARABIC[k]}</p>
                    </div>
                    <p className="font-mono text-lg font-semibold tabular-nums">{t ? fmt(t) : "--:--"}</p>
                  </div>
                  {LOGGABLE.includes(k) && (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <StatusBtn active={status === "on_time"} onClick={() => setStatus.mutate({ key: k, status: "on_time" })} color="primary" icon={Check} label="On time" />
                        <StatusBtn active={status === "late"} onClick={() => setStatus.mutate({ key: k, status: "late" })} color="accent" icon={Clock} label="Late" />
                        <StatusBtn active={status === "missed"} onClick={() => setStatus.mutate({ key: k, status: "missed" })} color="destructive" icon={X} label="Missed" />
                      </div>
                      {log && <button onClick={() => clear.mutate(k)} className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Clear</button>}
                    </>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      {tab === "qibla" && (
        <section className="glass-card rounded-3xl p-6 flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Qibla direction</p>
          <div className="relative mt-5 h-56 w-56 rounded-full border-2 border-border bg-surface grid place-items-center">
            <div className="absolute inset-3 rounded-full border border-border/60" />
            <div className="absolute top-2 text-[10px] text-muted-foreground">N</div>
            <div className="absolute bottom-2 text-[10px] text-muted-foreground">S</div>
            <div className="absolute left-2 text-[10px] text-muted-foreground">W</div>
            <div className="absolute right-2 text-[10px] text-muted-foreground">E</div>
            <div className="absolute top-1/2 left-1/2 h-24 w-1 -translate-x-1/2 -translate-y-full origin-bottom rounded-full hero-gradient"
              style={{ transform: `translate(-50%, -100%) rotate(${needle}deg)` }} />
            <Compass className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {heading == null ? "Tilt your phone to calibrate" : `${Math.round(heading)}° heading`} · Kaaba {Math.round(qiblaBearing)}°
          </p>
        </section>
      )}

      {tab === "settings" && <PrayerSettings />}
    </div>
  );
}

function StatusBtn({ active, onClick, color, icon: Icon, label }: any) {
  const cls = active
    ? color === "primary" ? "bg-primary text-primary-foreground"
      : color === "accent" ? "bg-accent text-accent-foreground"
      : "bg-destructive text-destructive-foreground"
    : "bg-surface text-muted-foreground";
  return (
    <button onClick={onClick} className={`h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function PrayerSettings() {
  const qc = useQueryClient();
  const q = usePrayerSettings();

  const [method, setMethod] = useState<MethodKey>("MWL");
  const [notif, setNotif] = useState(false);
  const [offsets, setOffsets] = useState({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
  const [loc, setLoc] = useState<{ latitude: number | null; longitude: number | null; city: string | null; country: string | null; timezone: string | null }>({ latitude: null, longitude: null, city: null, country: null, timezone: null });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (q.data) {
      const d = q.data as any;
      setMethod(d.method); setNotif(d.notifications);
      setOffsets({ fajr: d.fajr_offset, dhuhr: d.dhuhr_offset, asr: d.asr_offset, maghrib: d.maghrib_offset, isha: d.isha_offset });
      setLoc({ latitude: d.latitude, longitude: d.longitude, city: d.city, country: d.country, timezone: d.timezone });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("prayer_settings").upsert({
        user_id: user!.id, method, notifications: notif,
        fajr_offset: offsets.fajr, dhuhr_offset: offsets.dhuhr, asr_offset: offsets.asr,
        maghrib_offset: offsets.maghrib, isha_offset: offsets.isha,
        latitude: loc.latitude, longitude: loc.longitude,
        city: loc.city, country: loc.country, timezone: loc.timezone,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["prayer_settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const detect = async () => {
    setDetecting(true);
    try {
      const d = await detectLocation();
      setLoc(d);
      toast.success(`Detected ${d.city ?? "location"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Location denied. Search manually below.");
    } finally { setDetecting(false); }
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try { setResults(await searchLocation(search)); }
    catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  const pick = (r: any) => {
    setLoc({ latitude: r.latitude, longitude: r.longitude, city: r.city, country: r.country, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setResults([]); setSearch("");
  };

  return (
    <section className="space-y-4">
      <div className="glass-card rounded-3xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Location</p>
        {loc.latitude != null ? (
          <div className="rounded-2xl bg-surface p-3 text-sm">
            <p className="font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{loc.city ?? "Unknown"}{loc.country ? `, ${loc.country}` : ""}</p>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No location set.</p>
        )}
        <button onClick={detect} disabled={detecting} className="w-full h-10 rounded-xl bg-surface flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50">
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />} Use my location
        </button>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-input/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Search city or country" className="flex-1 h-10 bg-transparent text-sm outline-none" />
          </div>
          <button onClick={doSearch} disabled={searching} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <li key={i}>
                <button onClick={() => pick(r)} className="w-full text-left rounded-xl bg-surface p-3 text-xs hover:bg-surface-elevated">
                  <p className="font-semibold">{r.city ?? r.display.split(",")[0]}{r.country ? `, ${r.country}` : ""}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{r.display}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Calculation method</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`h-10 rounded-xl text-xs font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Offsets (minutes)</p>
        <div className="space-y-2">
          {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map(k => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-20 text-sm capitalize">{k}</span>
              <input type="number" value={offsets[k]} onChange={e => setOffsets({ ...offsets, [k]: +e.target.value })}
                className="flex-1 h-10 rounded-xl bg-input/60 px-3 text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 flex items-center justify-between">
        <span className="text-sm">Notifications</span>
        <button onClick={() => setNotif(!notif)} className={`h-7 w-12 rounded-full transition relative ${notif ? "bg-primary" : "bg-surface-elevated"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${notif ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="w-full h-12 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Save settings</button>
    </section>
  );
}
