import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Flame, Check, Sparkles, ArrowRight, Heart, ClipboardCheck, MapPin } from "lucide-react";
import { hijriToday, gregorianToday } from "@/lib/hijri";
import { usePrayerSettings, useNextPrayer, PRAYER_LABELS, PRAYER_ARABIC, fmt } from "@/lib/prayer-times";
import { getAvatarUrl, initialsOf } from "@/lib/avatar";
import { ProgressRing } from "@/components/ProgressRing";
import { syncAchievements } from "@/lib/achievements";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeScreen,
});

const LOGGABLE = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
const DAILY_AYAH_GOAL = 20;

function todayISO() { return new Date().toISOString().slice(0, 10); }

function HomeScreen() {
  const qc = useQueryClient();
  const settingsQ = usePrayerSettings();
  const np = useNextPrayer(settingsQ.data);

  useEffect(() => { syncAchievements().catch(() => {}); }, []);

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

  const prayerStreakQ = useQuery({
    queryKey: ["streak_prayer"],
    queryFn: async () => streakFrom(await fetchDates("prayer_logs", "prayer_date")),
  });

  const quranStreakQ = useQuery({
    queryKey: ["streak_quran"],
    queryFn: async () => streakFrom(await fetchDates("quran_progress", "read_date")),
  });

  const goalsQ = useQuery({
    queryKey: ["goals_today"],
    queryFn: async () => (await supabase.from("goals").select("*")).data ?? [],
  });

  const quranTodayQ = useQuery({
    queryKey: ["quran_today_count"],
    queryFn: async () => {
      const { data } = await supabase.from("quran_progress").select("ayah").eq("read_date", todayISO());
      return (data ?? []).reduce((a, r: any) => a + (r.ayah ?? 0), 0);
    },
  });

  const dhikrTodayQ = useQuery({
    queryKey: ["dhikr_today"],
    queryFn: async () => {
      const { data } = await supabase.from("dhikr_sessions").select("count, target").eq("session_date", todayISO());
      const sum = (data ?? []).reduce((a, r: any) => a + (r.count ?? 0), 0);
      const target = (data ?? []).reduce((a, r: any) => a + (r.target ?? 0), 0);
      return { sum, target: target || 100 };
    },
  });

  const togglePrayer = useMutation({
    mutationFn: async (key: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const exists = logsQ.data?.find((l: any) => l.prayer_name === key);
      if (exists) await supabase.from("prayer_logs").delete().eq("id", exists.id);
      else await supabase.from("prayer_logs").insert({ user_id: user!.id, prayer_name: key, prayer_date: todayISO(), status: "on_time" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prayer_logs"] }); qc.invalidateQueries({ queryKey: ["streak_prayer"] }); },
  });

  const done = logsQ.data?.length ?? 0;
  const prayerPct = Math.round((done / 5) * 100);

  const quranAyat = quranTodayQ.data ?? 0;
  const quranPct = Math.min(100, Math.round((quranAyat / DAILY_AYAH_GOAL) * 100));

  const dhikr = dhikrTodayQ.data ?? { sum: 0, target: 100 };
  const dhikrPct = Math.min(100, Math.round((dhikr.sum / Math.max(1, dhikr.target)) * 100));

  const goals = goalsQ.data ?? [];
  const goalsDone = goals.filter((g: any) => g.done || g.progress >= g.target).length;
  const goalsPct = goals.length ? Math.round((goalsDone / goals.length) * 100) : 0;

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/profile" className="h-12 w-12 shrink-0 rounded-2xl overflow-hidden hero-gradient grid place-items-center text-sm font-bold shadow-lg">
            <Avatar profile={profileQ.data} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Assalāmu ʿalaykum</p>
            <h1 className="mt-0.5 font-display text-xl font-semibold truncate">
              {profileQ.data?.display_name ?? profileQ.data?.full_name ?? "Friend"}
            </h1>
          </div>
        </div>
        <Link to="/profile" className="flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-xs shrink-0">
          <Flame className="h-3.5 w-3.5 text-accent" />
          <span className="font-semibold tabular-nums">{prayerStreakQ.data ?? 0}</span>
        </Link>
      </header>

      <p className="text-[11px] text-muted-foreground -mt-3">
        {gregorianToday()} <span className="opacity-50">·</span> {hijriToday()}
      </p>

      {/* ─── Hero: next prayer ─── */}
      <section className="hero-gradient rounded-[28px] p-6 shadow-2xl shadow-primary/30 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">Next prayer</p>
            {settingsQ.data?.city && (
              <span className="inline-flex items-center gap-1 text-[10px] opacity-80">
                <MapPin className="h-3 w-3" /> {settingsQ.data.city}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-5xl font-bold leading-none">{np ? PRAYER_LABELS[np.next.key] : "—"}</h2>
              <p className="mt-2 font-quran text-2xl opacity-90">{np ? PRAYER_ARABIC[np.next.key] : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-70">in</p>
              <p className="font-mono text-2xl font-bold tabular-nums">{np?.countdown ?? "--:--:--"}</p>
              <p className="text-xs opacity-80 mt-1">at {np ? fmt(np.next.at) : "—"}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Current: {np ? PRAYER_LABELS[np.current.key] : "—"}
            </span>
            <Link to="/prayer" className="ml-auto inline-flex items-center gap-1 opacity-90">
              All times <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Progress rings ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Today's progress</h3>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {Math.round((prayerPct + quranPct + dhikrPct + goalsPct) / 4)}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RingTile label="Prayer" value={prayerPct} caption={`${done}/5`} tint="primary" />
          <RingTile label="Qur'an" value={quranPct} caption={`${quranAyat}/${DAILY_AYAH_GOAL} ayāt`} tint="accent" />
          <RingTile label="Dhikr" value={dhikrPct} caption={`${dhikr.sum}/${dhikr.target}`} tint="primary" />
          <RingTile label="Goals" value={goalsPct} caption={`${goalsDone}/${goals.length || 0}`} tint="accent" />
        </div>
      </section>

      {/* ─── Prayer pills ─── */}
      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Today's prayers</h3>
          <span className="text-xs text-muted-foreground">{done}/5</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {LOGGABLE.map((k) => {
            const isDone = logsQ.data?.some((l: any) => l.prayer_name === k);
            return (
              <button key={k} onClick={() => togglePrayer.mutate(k)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition active:scale-95 ${isDone ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full ${isDone ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="text-[11px] font-medium">{PRAYER_LABELS[k]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Streaks ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Streaks</h3>
        <div className="grid grid-cols-3 gap-3">
          <StreakCard icon={Flame} label="Prayer" days={prayerStreakQ.data ?? 0} />
          <StreakCard icon={BookOpen} label="Qur'an" days={quranStreakQ.data ?? 0} />
          <StreakCard icon={Sparkles} label="Goals" days={goalsDone > 0 ? 1 : 0} />
        </div>
      </section>

      {/* ─── Quick actions ─── */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickTile to="/quran" icon={BookOpen} label="Continue Qur'an" sub={`${quranAyat} ayāt today`} tint="primary" />
          <QuickTile to="/goals" icon={Sparkles} label="Add Dhikr" sub={`${dhikr.sum} of ${dhikr.target}`} tint="accent" />
          <QuickTile to="/prayer" icon={Heart} label="Mark Prayer" sub={`${done}/5 today`} tint="primary" />
          <QuickTile to="/goals" icon={ClipboardCheck} label="Daily Check-in" sub={(checkinQ.data as any)?.dua_done ? "Done" : "Tap to log"} tint="accent" />
        </div>
      </section>
    </div>
  );
}

/* ───────── helpers ───────── */

async function fetchDates(table: "prayer_logs" | "quran_progress", col: "prayer_date" | "read_date"): Promise<string[]> {
  const { data } = await supabase.from(table).select(col).order(col, { ascending: false }).limit(300);
  return (data ?? []).map((r: any) => r[col]);
}
function streakFrom(dates: string[]): number {
  const set = new Set(dates);
  let s = 0; const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

function RingTile({ label, value, caption, tint }: { label: string; value: number; caption: string; tint: "primary" | "accent" }) {
  const ring = tint === "accent" ? "stroke-accent" : "stroke-primary";
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
      <ProgressRing value={value} size={56} stroke={6} ringClassName={ring}>
        <span className="text-[11px] font-bold tabular-nums">{value}%</span>
      </ProgressRing>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{caption}</p>
      </div>
    </div>
  );
}

function StreakCard({ icon: Icon, label, days }: { icon: any; label: string; days: number }) {
  return (
    <div className="glass-card rounded-2xl p-4 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{days}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickTile({ to, icon: Icon, label, sub, tint }: { to: string; icon: any; label: string; sub: string; tint: "primary" | "accent" }) {
  const cls = tint === "accent" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary";
  return (
    <Link to={to} className="glass-card rounded-2xl p-4 active:scale-[0.98] transition">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${cls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground truncate">{sub}</p>
    </Link>
  );
}

function Avatar({ profile }: { profile: any }) {
  const url = useQuery({
    queryKey: ["avatar_url", profile?.avatar_url],
    queryFn: () => getAvatarUrl(profile?.avatar_url),
    enabled: !!profile?.avatar_url,
  }).data;
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" />;
  return <span>{initialsOf(profile?.display_name ?? profile?.full_name, profile?.id)}</span>;
}
