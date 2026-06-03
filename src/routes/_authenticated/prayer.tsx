import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Check } from "lucide-react";

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

function todayISO() { return new Date().toISOString().slice(0, 10); }

function PrayerScreen() {
  const qc = useQueryClient();
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
    queryFn: async () => {
      const { data } = await supabase.from("prayer_logs").select("*").eq("prayer_date", todayISO());
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (key: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const exists = logsQ.data?.find((l: any) => l.prayer_name === key);
      if (exists) await supabase.from("prayer_logs").delete().eq("id", exists.id);
      else await supabase.from("prayer_logs").insert({ user_id: user!.id, prayer_name: key, prayer_date: todayISO() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prayer_logs"] }),
  });

  const qibla = 124;
  const needle = heading == null ? qibla : qibla - heading;

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Prayer</p>
        <h1 className="mt-1 text-2xl font-semibold">Today's schedule</h1>
      </header>

      <section className="glass-card rounded-3xl p-6 flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Qibla</p>
        <div className="relative mt-4 h-44 w-44 rounded-full border-2 border-border bg-surface grid place-items-center">
          <div className="absolute inset-3 rounded-full border border-border/60" />
          <div className="absolute top-2 text-[10px] text-muted-foreground">N</div>
          <div className="absolute bottom-2 text-[10px] text-muted-foreground">S</div>
          <div className="absolute left-2 text-[10px] text-muted-foreground">W</div>
          <div className="absolute right-2 text-[10px] text-muted-foreground">E</div>
          <div
            className="absolute top-1/2 left-1/2 h-20 w-1 -translate-x-1/2 -translate-y-full origin-bottom rounded-full hero-gradient"
            style={{ transform: `translate(-50%, -100%) rotate(${needle}deg)` }}
          />
          <Compass className="h-6 w-6 text-primary" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{heading == null ? "Calibrating compass…" : `${Math.round(heading)}° heading · Kaaba ${qibla}°`}</p>
      </section>

      <section className="space-y-2">
        {PRAYERS.map((p) => {
          const done = logsQ.data?.some((l: any) => l.prayer_name === p.key);
          return (
            <button
              key={p.key}
              onClick={() => toggle.mutate(p.key)}
              className={`w-full rounded-2xl p-4 flex items-center gap-4 transition ${done ? "bg-primary/15 border border-primary/30" : "glass-card"}`}
            >
              <div className={`grid h-11 w-11 place-items-center rounded-2xl ${done ? "bg-primary text-primary-foreground" : "bg-surface text-primary"}`}>
                {done ? <Check className="h-5 w-5" /> : <span className="text-lg">{p.arabic.slice(0, 1)}</span>}
              </div>
              <div className="flex-1 text-left">
                <p className="text-base font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.arabic}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold tabular-nums">{p.time}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{done ? "Logged" : "Tap to log"}</p>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
