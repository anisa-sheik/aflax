import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Compass, BookOpen, NotebookPen, Flame, Check, Heart, Sparkles, BarChart3 } from "lucide-react";
import { hijriToday, gregorianToday } from "@/lib/hijri";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeScreen,
});

const PRAYERS = [
  { key: "fajr", label: "Fajr", time: "05:12" },
  { key: "dhuhr", label: "Dhuhr", time: "12:34" },
  { key: "asr", label: "Asr", time: "15:48" },
  { key: "maghrib", label: "Maghrib", time: "18:22" },
  { key: "isha", label: "Isha", time: "19:51" },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function useNextPrayer() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return useMemo(() => {
    const cur = now.getHours() * 60 + now.getMinutes();
    let next = PRAYERS[0];
    let mins = (24 * 60 - cur) + (5 * 60 + 12);
    for (const p of PRAYERS) {
      const [h, m] = p.time.split(":").map(Number);
      const total = h * 60 + m;
      if (total > cur) { next = p; mins = total - cur; break; }
    }
    const remSec = Math.max(0, mins * 60 - now.getSeconds());
    const h = Math.floor(remSec / 3600);
    const m = Math.floor((remSec % 3600) / 60);
    const s = remSec % 60;
    return { next, countdown: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
  }, [now]);
}

function HomeScreen() {
  const qc = useQueryClient();
  const { next, countdown } = useNextPrayer();

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const logsQ = useQuery({
    queryKey: ["prayer_logs", todayISO()],
    queryFn: async () => (await supabase.from("prayer_logs").select("*").eq("prayer_date", todayISO())).data ?? [],
  });

  const checkinQ = useQuery({
    queryKey: ["checkin", todayISO()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("daily_checkins").select("*")
        .eq("user_id", user!.id).eq("checkin_date", todayISO()).maybeSingle();
      return data;
    },
  });

  const streakQ = useQuery({
    queryKey: ["streak"],
    queryFn: async () => {
      const { data } = await supabase.from("prayer_logs").select("prayer_date").order("prayer_date", { ascending: false }).limit(200);
      const dates = new Set((data ?? []).map((r: any) => r.prayer_date));
      let streak = 0;
      const d = new Date();
      while (dates.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
      return streak;
    },
  });

  const togglePrayer = useMutation({
    mutationFn: async (key: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const exists = logsQ.data?.find((l: any) => l.prayer_name === key);
      if (exists) await supabase.from("prayer_logs").delete().eq("id", exists.id);
      else await supabase.from("prayer_logs").insert({ user_id: user!.id, prayer_name: key, prayer_date: todayISO(), status: "on_time" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prayer_logs"] }); qc.invalidateQueries({ queryKey: ["streak"] }); },
  });

  const toggleCheckin = useMutation({
    mutationFn: async (field: "quran_done" | "dhikr_done" | "dua_done") => {
      const { data: { user } } = await supabase.auth.getUser();
      const cur = checkinQ.data as any;
      const newVal = !(cur?.[field] ?? false);
      await supabase.from("daily_checkins").upsert({
        user_id: user!.id,
        checkin_date: todayISO(),
        quran_done: field === "quran_done" ? newVal : (cur?.quran_done ?? false),
        dhikr_done: field === "dhikr_done" ? newVal : (cur?.dhikr_done ?? false),
        dua_done: field === "dua_done" ? newVal : (cur?.dua_done ?? false),
      }, { onConflict: "user_id,checkin_date" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin"] }),
  });

  const done = logsQ.data?.length ?? 0;
  const pct = Math.round((done / 5) * 100);
  const c = checkinQ.data as any;
  const checklist = [
    { key: "quran_done" as const, label: "Qur'an", icon: BookOpen, done: c?.quran_done },
    { key: "dhikr_done" as const, label: "Dhikr", icon: Sparkles, done: c?.dhikr_done },
    { key: "dua_done" as const, label: "Daily duʿāʾ", icon: Heart, done: c?.dua_done },
  ];
  const checklistDone = checklist.filter(x => x.done).length;
  const overall = Math.round(((done + checklistDone) / 8) * 100);

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Assalāmu ʿalaykum</p>
          <h1 className="mt-1 text-2xl font-semibold">{profileQ.data?.display_name ?? "Friend"}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{gregorianToday()} · {hijriToday()}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs">
          <Flame className="h-3.5 w-3.5 text-accent" />
          <span className="font-semibold">{streakQ.data ?? 0}</span>
          <span className="text-muted-foreground">day</span>
        </div>
      </header>

      <section className="hero-gradient rounded-3xl p-6 shadow-2xl shadow-primary/30">
        <p className="text-xs uppercase tracking-widest opacity-70">Next prayer</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h2 className="text-4xl font-bold">{next.label}</h2>
            <p className="mt-1 text-sm opacity-80">at {next.time}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase opacity-70">in</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{countdown}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-black/20 overflow-hidden">
          <div className="h-full bg-white/80 transition-all" style={{ width: `${overall}%` }} />
        </div>
        <p className="mt-1.5 text-xs opacity-80">Today {overall}% complete</p>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Today's prayers</h3>
          <span className="text-xs text-muted-foreground">{done}/5 · {pct}%</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {PRAYERS.map((p) => {
            const isDone = logsQ.data?.some((l: any) => l.prayer_name === p.key);
            return (
              <button key={p.key} onClick={() => togglePrayer.mutate(p.key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition ${isDone ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full ${isDone ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="text-[11px] font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Daily check-in</h3>
          <span className="text-xs text-muted-foreground">{checklistDone}/3</span>
        </div>
        <div className="mt-3 space-y-2">
          {checklist.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => toggleCheckin.mutate(item.key)}
                className={`w-full rounded-2xl p-3 flex items-center gap-3 transition ${item.done ? "bg-primary/15 border border-primary/30" : "bg-surface"}`}>
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${item.done ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-primary"}`}>
                  {item.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="flex-1 text-left text-sm font-semibold">{item.label}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.done ? "Done" : "Tap"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickTile to="/quran" icon={BookOpen} label="Read Qur'an" sub="Open last surah" />
          <QuickTile to="/goals" icon={Sparkles} label="Log dhikr" sub="Add a session" />
          <QuickTile to="/goals" icon={NotebookPen} label="Journal" sub="Reflect today" />
          <QuickTile to="/goals" icon={BarChart3} label="Analytics" sub="See your week" />
        </div>
      </section>
    </div>
  );
}

function QuickTile({ to, icon: Icon, label, sub }: { to: string; icon: any; label: string; sub: string }) {
  return (
    <Link to={to} className="glass-card rounded-2xl p-4 active:scale-[0.98] transition">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}
