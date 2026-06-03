import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Target, NotebookPen, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tracker")({
  component: TrackerScreen,
});

function todayISO() { return new Date().toISOString().slice(0, 10); }

const DHIKR_OPTS = [
  { name: "SubhanAllah", target: 33 },
  { name: "Alhamdulillah", target: 33 },
  { name: "Allahu Akbar", target: 34 },
  { name: "Astaghfirullah", target: 100 },
];

function TrackerScreen() {
  const [tab, setTab] = useState<"dhikr" | "goals" | "journal">("dhikr");
  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Tracker</p>
        <h1 className="mt-1 text-2xl font-semibold">Build the habit</h1>
      </header>
      <div className="flex rounded-full bg-surface p-1 text-sm">
        {(["dhikr", "goals", "journal"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize transition ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
          >{t}</button>
        ))}
      </div>
      {tab === "dhikr" && <DhikrPanel />}
      {tab === "goals" && <GoalsPanel />}
      {tab === "journal" && <JournalPanel />}
    </div>
  );
}

function DhikrPanel() {
  const qc = useQueryClient();
  const [active, setActive] = useState(DHIKR_OPTS[0]);
  const [count, setCount] = useState(0);

  const todayQ = useQuery({
    queryKey: ["dhikr_today"],
    queryFn: async () => {
      const { data } = await supabase.from("dhikr_sessions").select("*").eq("session_date", todayISO());
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("dhikr_sessions").insert({ user_id: user!.id, dhikr_name: active.name, count, target: active.target });
    },
    onSuccess: () => { toast.success("Saved"); setCount(0); qc.invalidateQueries({ queryKey: ["dhikr_today"] }); },
  });

  const total = (todayQ.data ?? []).reduce((s, r: any) => s + (r.count || 0), 0);
  const pct = Math.min(100, Math.round((count / active.target) * 100));

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{active.name}</p>
            <p className="text-3xl font-bold">{count}<span className="text-base text-muted-foreground">/{active.target}</span></p>
          </div>
          <button onClick={() => setCount(0)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 h-2 rounded-full bg-surface overflow-hidden">
          <div className="h-full hero-gradient transition-all" style={{ width: `${pct}%` }} />
        </div>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="mt-5 h-32 w-full rounded-3xl hero-gradient text-2xl font-bold shadow-2xl shadow-primary/30 active:scale-[0.98] transition"
        >Tap to count</button>
        <button
          disabled={count === 0 || save.isPending}
          onClick={() => save.mutate()}
          className="mt-3 w-full h-11 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold disabled:opacity-50"
        >Save session</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {DHIKR_OPTS.map((d) => (
          <button key={d.name} onClick={() => { setActive(d); setCount(0); }}
            className={`rounded-2xl p-3 text-left ${active.name === d.name ? "bg-primary/15 border border-primary/40" : "glass-card"}`}>
            <p className="text-sm font-semibold">{d.name}</p>
            <p className="text-xs text-muted-foreground">target {d.target}</p>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">Today: {total} total · {todayQ.data?.length ?? 0} sessions</p>
    </div>
  );
}

function GoalsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(7);

  const q = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("goals").insert({ user_id: user!.id, title, target });
    },
    onSuccess: () => { setOpen(false); setTitle(""); setTarget(7); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  const tick = useMutation({
    mutationFn: async (g: any) => {
      const np = Math.min(g.target, g.progress + 1);
      await supabase.from("goals").update({ progress: np, done: np >= g.target }).eq("id", g.id);
    },
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
                <p className="text-xs text-muted-foreground">{g.progress}/{g.target}</p>
              </div>
              <button onClick={() => tick.mutate(g)} disabled={g.done}
                className={`grid h-10 w-10 place-items-center rounded-xl ${g.done ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
                {g.done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full hero-gradient" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {q.data && q.data.length === 0 && <EmptyState text="No goals yet. Add your first." />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-surface-elevated p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-12 rounded-full bg-border" />
            <h3 className="text-lg font-semibold">New goal</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read 1 juz this week"
              className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm" />
            <input type="number" min={1} value={target} onChange={(e) => setTarget(+e.target.value)}
              className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm" />
            <button disabled={!title || add.isPending} onClick={() => add.mutate()}
              className="w-full h-12 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Create</button>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalPanel() {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("🙂");

  const q = useQuery({
    queryKey: ["journal"],
    queryFn: async () => (await supabase.from("journal_entries").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("journal_entries").insert({ user_id: user!.id, content, mood });
    },
    onSuccess: () => { setContent(""); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["journal"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">How is your heart today?</p>
        </div>
        <div className="flex gap-2">
          {["😔", "😐", "🙂", "😊", "🤲"].map(m => (
            <button key={m} onClick={() => setMood(m)}
              className={`h-10 w-10 rounded-2xl text-xl ${mood === m ? "bg-primary/20 ring-2 ring-primary" : "bg-surface"}`}>{m}</button>
          ))}
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="A reflection, a duʿāʾ, a thought…"
          className="w-full rounded-2xl bg-input/60 p-3 text-sm outline-none" />
        <button disabled={!content || add.isPending} onClick={() => add.mutate()}
          className="w-full h-11 rounded-2xl hero-gradient font-semibold disabled:opacity-50">Save entry</button>
      </div>

      <div className="space-y-2">
        {(q.data ?? []).map((e: any) => (
          <div key={e.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xl">{e.mood}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{e.content}</p>
          </div>
        ))}
        {q.data && q.data.length === 0 && <EmptyState text="Your reflections will appear here." />}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-xs text-muted-foreground py-8">{text}</p>;
}
