import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Target, NotebookPen, Check, Sparkles, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsScreen,
});

const DHIKR_PRESETS = ["SubhanAllah", "Alhamdulillah", "Allahu Akbar", "Astaghfirullah", "La ilaha illa Allah", "Salawat"];

function GoalsScreen() {
  const [tab, setTab] = useState<"goals" | "dhikr" | "journal" | "stats">("goals");
  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Tracker</p>
        <h1 className="mt-1 text-2xl font-semibold">Grow daily</h1>
      </header>
      <div className="flex rounded-full bg-surface p-1 text-xs">
        {(["goals", "dhikr", "journal", "stats"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize transition ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      {tab === "goals" && <GoalsPanel />}
      {tab === "dhikr" && <DhikrPanel />}
      {tab === "journal" && <JournalPanel />}
      {tab === "stats" && <StatsPanel />}
    </div>
  );
}

function GoalsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(7);
  const [category, setCategory] = useState("general");

  const q = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("goals").insert({ user_id: user!.id, title, target, category });
    },
    onSuccess: () => { setOpen(false); setTitle(""); setTarget(7); toast.success("Goal added"); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });
  const tick = useMutation({
    mutationFn: async (g: any) => {
      const np = Math.min(g.target, g.progress + 1);
      await supabase.from("goals").update({ progress: np, done: np >= g.target }).eq("id", g.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(true)} className="w-full h-12 rounded-2xl hero-gradient font-semibold flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> New goal
      </button>
      {(q.data ?? []).map((g: any) => {
        const pct = Math.round((g.progress / g.target) * 100);
        return (
          <div key={g.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{g.title}</p>
                <p className="text-xs text-muted-foreground">{g.progress}/{g.target} · {g.category}</p>
              </div>
              <button onClick={() => tick.mutate(g)} disabled={g.done}
                className={`grid h-10 w-10 place-items-center rounded-xl ${g.done ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
                {g.done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
              <button onClick={() => del.mutate(g.id)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full hero-gradient" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {q.data && q.data.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No goals yet. Tap above to add your first.</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-surface-elevated p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="mx-auto h-1 w-12 rounded-full bg-border" />
            <h3 className="text-lg font-semibold">New goal</h3>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Read 1 juz this week"
              className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={1} value={target} onChange={e => setTarget(+e.target.value)} placeholder="Target"
                className="h-12 rounded-2xl bg-input/60 px-4 text-sm" />
              <select value={category} onChange={e => setCategory(e.target.value)} className="h-12 rounded-2xl bg-input/60 px-4 text-sm">
                <option value="general">General</option>
                <option value="prayer">Prayer</option>
                <option value="quran">Qur'an</option>
                <option value="dhikr">Dhikr</option>
                <option value="charity">Charity</option>
                <option value="fasting">Fasting</option>
              </select>
            </div>
            <button disabled={!title || add.isPending} onClick={() => add.mutate()}
              className="w-full h-12 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Create</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DhikrPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("Astaghfirullah");
  const [count, setCount] = useState(100);

  const q = useQuery({
    queryKey: ["dhikr_all"],
    queryFn: async () => (await supabase.from("dhikr_sessions").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("dhikr_sessions").insert({ user_id: user!.id, dhikr_name: name, count, target: count });
    },
    onSuccess: () => { toast.success("Logged"); qc.invalidateQueries({ queryKey: ["dhikr_all"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("dhikr_sessions").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhikr_all"] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = (q.data ?? []).filter((r: any) => r.session_date === today).reduce((s: number, r: any) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Log a dhikr session</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DHIKR_PRESETS.map(p => (
            <button key={p} onClick={() => setName(p)}
              className={`h-10 rounded-xl text-xs font-semibold ${name === p ? "bg-primary/20 text-primary border border-primary/40" : "bg-surface text-muted-foreground"}`}>{p}</button>
          ))}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Dhikr name"
          className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Count</span>
          <input type="number" min={1} value={count} onChange={e => setCount(+e.target.value)}
            className="flex-1 h-12 rounded-2xl bg-input/60 px-4 text-sm" />
        </div>
        <div className="flex gap-2">
          {[33, 100, 500, 1000].map(n => (
            <button key={n} onClick={() => setCount(n)} className="flex-1 h-9 rounded-xl bg-surface text-xs font-semibold">{n}</button>
          ))}
        </div>
        <button disabled={!name || count < 1 || add.isPending} onClick={() => add.mutate()}
          className="w-full h-12 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Save entry</button>
      </div>

      <p className="text-center text-xs text-muted-foreground">Today: <span className="font-bold text-foreground">{todayTotal}</span> total</p>

      <div className="space-y-2">
        {(q.data ?? []).map((e: any) => (
          <div key={e.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{e.dhikr_name}</p>
              <p className="text-xs text-muted-foreground">{e.count}× · {new Date(e.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => del.mutate(e.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-surface">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No entries yet.</p>}
      </div>
    </div>
  );
}

function JournalPanel() {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("🙂");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["journal"],
    queryFn: async () => (await supabase.from("journal_entries").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("journal_entries").insert({ user_id: user!.id, content, mood });
    },
    onSuccess: () => { setContent(""); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["journal"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("journal_entries").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const filtered = (q.data ?? []).filter((e: any) => !search || e.content.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">What's on your heart today?</p>
        </div>
        <div className="flex gap-2">
          {["😔", "😐", "🙂", "😊", "🤲"].map(m => (
            <button key={m} onClick={() => setMood(m)}
              className={`h-10 w-10 rounded-2xl text-xl ${mood === m ? "bg-primary/20 ring-2 ring-primary" : "bg-surface"}`}>{m}</button>
          ))}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
          placeholder="A reflection, an ayah that inspired you, what went well, what to improve…"
          className="w-full rounded-2xl bg-input/60 p-3 text-sm outline-none" />
        <button disabled={!content || add.isPending} onClick={() => add.mutate()}
          className="w-full h-11 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Save entry</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…"
        className="w-full h-11 rounded-2xl bg-surface px-4 text-sm" />

      <div className="space-y-2">
        {filtered.map((e: any) => (
          <div key={e.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xl">{e.mood}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                <button onClick={() => del.mutate(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{e.content}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Your reflections will appear here.</p>}
      </div>
    </div>
  );
}

function StatsPanel() {
  const prayersQ = useQuery({
    queryKey: ["stats_prayers"],
    queryFn: async () => (await supabase.from("prayer_logs").select("prayer_date,status").gte("prayer_date", daysAgo(30))).data ?? [],
  });
  const dhikrQ = useQuery({
    queryKey: ["stats_dhikr"],
    queryFn: async () => (await supabase.from("dhikr_sessions").select("session_date,count").gte("session_date", daysAgo(30))).data ?? [],
  });
  const quranQ = useQuery({
    queryKey: ["stats_quran"],
    queryFn: async () => (await supabase.from("quran_progress").select("read_date,minutes_read").gte("read_date", daysAgo(30))).data ?? [],
  });

  const weekData = useMemo(() => {
    const days = lastNDays(7);
    return days.map(d => {
      const dayPrayers = (prayersQ.data ?? []).filter((p: any) => p.prayer_date === d);
      const onTime = dayPrayers.filter((p: any) => p.status === "on_time").length;
      const late = dayPrayers.filter((p: any) => p.status === "late").length;
      return { day: d.slice(5), onTime, late };
    });
  }, [prayersQ.data]);

  const dhikrTrend = useMemo(() => {
    const days = lastNDays(14);
    return days.map(d => ({
      day: d.slice(5),
      count: (dhikrQ.data ?? []).filter((r: any) => r.session_date === d).reduce((s: number, r: any) => s + r.count, 0),
    }));
  }, [dhikrQ.data]);

  const totalPrayers = (prayersQ.data ?? []).length;
  const onTimePct = totalPrayers ? Math.round(((prayersQ.data ?? []).filter((p: any) => p.status === "on_time").length / totalPrayers) * 100) : 0;
  const totalDhikr = (dhikrQ.data ?? []).reduce((s: number, r: any) => s + r.count, 0);
  const totalMin = (quranQ.data ?? []).reduce((s: number, r: any) => s + r.minutes_read, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="On-time" value={`${onTimePct}%`} />
        <Metric label="Dhikr 30d" value={totalDhikr} />
        <Metric label="Min read" value={totalMin} />
      </div>

      <div className="glass-card rounded-3xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Prayers this week</p>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <XAxis dataKey="day" stroke="oklch(0.7 0.02 160)" fontSize={10} />
              <YAxis stroke="oklch(0.7 0.02 160)" fontSize={10} />
              <Tooltip contentStyle={{ background: "oklch(0.3 0.032 175)", border: "1px solid oklch(0.5 0.04 170 / 0.25)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="onTime" stackId="a" fill="oklch(0.78 0.14 160)" />
              <Bar dataKey="late" stackId="a" fill="oklch(0.82 0.13 80)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-4">
        <p className="text-sm font-semibold mb-3">Dhikr trend (14 days)</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dhikrTrend}>
              <XAxis dataKey="day" stroke="oklch(0.7 0.02 160)" fontSize={10} />
              <YAxis stroke="oklch(0.7 0.02 160)" fontSize={10} />
              <Tooltip contentStyle={{ background: "oklch(0.3 0.032 175)", border: "1px solid oklch(0.5 0.04 170 / 0.25)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="oklch(0.88 0.12 155)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function lastNDays(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
