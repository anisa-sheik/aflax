import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quran")({
  component: QuranScreen,
});

const SURAHS = [
  { n: 1, name: "Al-Fatihah", ayat: 7 },
  { n: 2, name: "Al-Baqarah", ayat: 286 },
  { n: 18, name: "Al-Kahf", ayat: 110 },
  { n: 36, name: "Ya-Sin", ayat: 83 },
  { n: 55, name: "Ar-Rahman", ayat: 78 },
  { n: 67, name: "Al-Mulk", ayat: 30 },
  { n: 112, name: "Al-Ikhlas", ayat: 4 },
  { n: 113, name: "Al-Falaq", ayat: 5 },
  { n: 114, name: "An-Nas", ayat: 6 },
];

function nameOf(n: number) { return SURAHS.find(s => s.n === n)?.name ?? `Surah ${n}`; }

function QuranScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"progress" | "bookmarks">("progress");
  const [open, setOpen] = useState(false);
  const [bmOpen, setBmOpen] = useState(false);
  const [surah, setSurah] = useState(67);
  const [ayah, setAyah] = useState(1);
  const [minutes, setMinutes] = useState(10);
  const [bmNote, setBmNote] = useState("");
  const [goalDays, setGoalDays] = useState<30 | 90 | 180 | 365>(90);

  const progressQ = useQuery({
    queryKey: ["quran_progress"],
    queryFn: async () => (await supabase.from("quran_progress").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const totalMin = (progressQ.data ?? []).reduce((s, r: any) => s + (r.minutes_read || 0), 0);
  const last = progressQ.data?.[0] as any;
  const totalPages = Math.round(totalMin / 2);
  const goalPages = 604;
  const dailyTarget = Math.ceil(goalPages / goalDays);
  const completionPct = Math.min(100, Math.round((totalPages / goalPages) * 100));

  const log = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("quran_progress").insert({ user_id: user!.id, surah, ayah, minutes_read: minutes });
    },
    onSuccess: () => { toast.success("Session logged"); setOpen(false); qc.invalidateQueries({ queryKey: ["quran_progress"] }); },
  });

  const addBm = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("quran_bookmarks").insert({ user_id: user!.id, surah, ayah, note: bmNote || null });
    },
    onSuccess: () => { toast.success("Bookmarked"); setBmOpen(false); setBmNote(""); qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }); },
  });

  const delBm = useMutation({
    mutationFn: async (id: string) => { await supabase.from("quran_bookmarks").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }),
  });

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Qur'an</p>
          <h1 className="mt-1 text-2xl font-semibold">Reading</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBmOpen(true)} className="grid h-11 w-11 place-items-center rounded-2xl bg-surface">
            <Bookmark className="h-5 w-5 text-primary" />
          </button>
          <button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-2xl hero-gradient shadow-lg">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="hero-gradient rounded-3xl p-6 shadow-2xl shadow-primary/30">
        <p className="text-xs uppercase tracking-widest opacity-80">Continue where you left</p>
        <h2 className="mt-2 text-3xl font-bold">{last ? nameOf(last.surah) : "Al-Mulk"}</h2>
        <p className="mt-1 text-sm opacity-80">Ayah {last?.ayah ?? 1}</p>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="opacity-80">{totalMin} min · ~{totalPages} pages</span>
          <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">{progressQ.data?.length ?? 0} sessions</span>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Khatm goal</h3>
          <span className="text-xs text-muted-foreground">{completionPct}%</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {([30, 90, 180, 365] as const).map(d => (
            <button key={d} onClick={() => setGoalDays(d)}
              className={`h-9 rounded-xl text-xs font-semibold ${goalDays === d ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>
              {d === 365 ? "1 yr" : `${d}d`}
            </button>
          ))}
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface overflow-hidden">
          <div className="h-full hero-gradient" style={{ width: `${completionPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Daily target: ~{dailyTarget} pages</p>
      </section>

      <div className="flex rounded-full bg-surface p-1 text-sm">
        {(["progress", "bookmarks"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "progress" && (
        <section className="space-y-2">
          {(progressQ.data ?? []).slice(0, 15).map((r: any) => (
            <div key={r.id} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary font-semibold text-sm">{r.surah}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{nameOf(r.surah)} · Ayah {r.ayah}</p>
                <p className="text-xs text-muted-foreground">{r.minutes_read} min · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
          {(!progressQ.data || progressQ.data.length === 0) && (
            <p className="text-center text-xs text-muted-foreground py-8">No sessions yet. Tap + to log one.</p>
          )}
        </section>
      )}

      {tab === "bookmarks" && (
        <section className="space-y-2">
          {(bookmarksQ.data ?? []).map((b: any) => (
            <div key={b.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <Bookmark className="h-4 w-4 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{nameOf(b.surah)} · Ayah {b.ayah}</p>
                {b.note && <p className="text-xs text-muted-foreground mt-0.5">{b.note}</p>}
              </div>
              <button onClick={() => delBm.mutate(b.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-surface">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
          {(!bookmarksQ.data || bookmarksQ.data.length === 0) && (
            <p className="text-center text-xs text-muted-foreground py-8">No bookmarks yet.</p>
          )}
        </section>
      )}

      {(open || bmOpen) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => { setOpen(false); setBmOpen(false); }}>
          <div className="w-full max-w-md rounded-t-3xl bg-surface-elevated p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="mx-auto h-1 w-12 rounded-full bg-border" />
            <h3 className="text-lg font-semibold">{open ? "Log reading session" : "Add bookmark"}</h3>
            <select value={surah} onChange={e => setSurah(+e.target.value)} className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm">
              {SURAHS.map(s => <option key={s.n} value={s.n}>{s.n}. {s.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min={1} value={ayah} onChange={e => setAyah(+e.target.value)} placeholder="Ayah" className="h-12 rounded-2xl bg-input/60 px-4 text-sm" />
              {open && <input type="number" min={1} value={minutes} onChange={e => setMinutes(+e.target.value)} placeholder="Minutes" className="h-12 rounded-2xl bg-input/60 px-4 text-sm" />}
            </div>
            {bmOpen && (
              <input value={bmNote} onChange={e => setBmNote(e.target.value)} placeholder="Note (optional)"
                className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm" />
            )}
            <button disabled={log.isPending || addBm.isPending} onClick={() => open ? log.mutate() : addBm.mutate()}
              className="w-full h-12 rounded-2xl hero-gradient font-semibold">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
