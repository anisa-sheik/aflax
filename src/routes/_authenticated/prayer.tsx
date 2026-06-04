import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prayer")({
  component: PrayerScreen,
});

const PRAYERS = [
  { key: "fajr", label: "Fajr", time: "05:12", arabic: "الفجر" },
  { key: "dhuhr", label: "Dhuhr", time: "12:34", arabic: "الظهر" },
  { key: "asr", label: "Asr", time: "15:48", arabic: "العصر" },
  { key: "maghrib", label: "Maghrib", time: "18:22", arabic: "المغرب" },
  { key: "isha", label: "Isha", time: "19:51", arabic: "العشاء" },
];
const METHODS = ["MWL", "ISNA", "Umm Al-Qura", "Egyptian", "Karachi"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function PrayerScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"today" | "qibla" | "settings">("today");
  const [heading, setHeading] = useState<number | null>(null);

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

  const qibla = 124;
  const needle = heading == null ? qibla : qibla - heading;

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Prayer</p>
        <h1 className="mt-1 text-2xl font-semibold">Salah</h1>
      </header>

      <div className="flex rounded-full bg-surface p-1 text-sm">
        {(["today", "qibla", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize transition ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "today" && (
        <section className="space-y-2">
          {PRAYERS.map((p) => {
            const log = (logsQ.data ?? []).find((l: any) => l.prayer_name === p.key) as any;
            const status = log?.status;
            return (
              <div key={p.key} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface text-primary">
                    <span className="text-lg">{p.arabic.slice(0, 1)}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.arabic}</p>
                  </div>
                  <p className="font-mono text-lg font-semibold tabular-nums">{p.time}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <StatusBtn active={status === "on_time"} onClick={() => setStatus.mutate({ key: p.key, status: "on_time" })}
                    color="primary" icon={Check} label="On time" />
                  <StatusBtn active={status === "late"} onClick={() => setStatus.mutate({ key: p.key, status: "late" })}
                    color="accent" icon={Clock} label="Late" />
                  <StatusBtn active={status === "missed"} onClick={() => setStatus.mutate({ key: p.key, status: "missed" })}
                    color="destructive" icon={X} label="Missed" />
                </div>
                {log && (
                  <button onClick={() => clear.mutate(p.key)} className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Clear</button>
                )}
              </div>
            );
          })}
        </section>
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
          <p className="mt-4 text-xs text-muted-foreground">{heading == null ? "Tilt your phone to calibrate" : `${Math.round(heading)}° heading · Kaaba ${qibla}°`}</p>
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
  const q = useQuery({
    queryKey: ["prayer_settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("prayer_settings").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [method, setMethod] = useState("MWL");
  const [notif, setNotif] = useState(false);
  const [offsets, setOffsets] = useState({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });

  useEffect(() => {
    if (q.data) {
      const d = q.data as any;
      setMethod(d.method); setNotif(d.notifications);
      setOffsets({ fajr: d.fajr_offset, dhuhr: d.dhuhr_offset, asr: d.asr_offset, maghrib: d.maghrib_offset, isha: d.isha_offset });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("prayer_settings").upsert({
        user_id: user!.id, method, notifications: notif,
        fajr_offset: offsets.fajr, dhuhr_offset: offsets.dhuhr, asr_offset: offsets.asr,
        maghrib_offset: offsets.maghrib, isha_offset: offsets.isha,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["prayer_settings"] }); },
  });

  return (
    <section className="glass-card rounded-3xl p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Calculation method</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`h-10 rounded-xl text-xs font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>{m}</button>
          ))}
        </div>
      </div>
      <div>
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
      <div className="flex items-center justify-between">
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
