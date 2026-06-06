import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, ChevronLeft, Search, Trash2, Loader2, ArrowRight, Sparkles, Type, Minus, Plus } from "lucide-react";
import { fetchSurahs, fetchSurahAyahs, type Surah } from "@/lib/quran-api";
import { ProgressRing } from "@/components/ProgressRing";

export const Route = createFileRoute("/_authenticated/quran")({
  component: QuranScreen,
});

const DAILY_AYAH_GOAL = 20;

function QuranScreen() {
  const [open, setOpen] = useState<{ surah: number; ayah?: number } | null>(null);
  return open ? (
    <Reader surah={open.surah} initialAyah={open.ayah ?? 1} onBack={() => setOpen(null)} />
  ) : (
    <SurahList onOpen={(s, a) => setOpen({ surah: s, ayah: a })} />
  );
}

/* ───────────── Surah list ───────────── */

function todayISO() { return new Date().toISOString().slice(0, 10); }

function SurahList({ onOpen }: { onOpen: (surah: number, ayah?: number) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"surahs" | "bookmarks">("surahs");

  const surahsQ = useQuery({ queryKey: ["surahs"], queryFn: fetchSurahs, staleTime: Infinity });

  const stateQ = useQuery({
    queryKey: ["quran_state"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("quran_reading_state").select("*").eq("user_id", user!.id).maybeSingle();
      return data as { surah: number; ayah: number } | null;
    },
  });

  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const progressQ = useQuery({
    queryKey: ["quran_progress_today"],
    queryFn: async () => (await supabase.from("quran_progress").select("*").eq("read_date", todayISO())).data ?? [],
  });

  const totalQ = useQuery({
    queryKey: ["quran_progress_total"],
    queryFn: async () => (await supabase.from("quran_progress").select("ayah, surah, read_date")).data ?? [],
  });

  const delBm = useMutation({
    mutationFn: async (id: string) => { await supabase.from("quran_bookmarks").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }),
  });

  const filtered = useMemo(() => {
    const list = surahsQ.data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(x =>
      x.englishName.toLowerCase().includes(s) ||
      x.englishNameTranslation.toLowerCase().includes(s) ||
      String(x.number) === s
    );
  }, [surahsQ.data, q]);

  const last = stateQ.data;
  const lastSurah = last ? (surahsQ.data ?? []).find(s => s.number === last.surah) : null;

  const ayahsToday = (progressQ.data ?? []).reduce((acc: number, r: any) => acc + (r.ayah ?? 0), 0);
  const goalPct = Math.min(100, Math.round((ayahsToday / DAILY_AYAH_GOAL) * 100));

  // streak: consecutive days with progress
  const streak = useMemo(() => {
    const dates = new Set((totalQ.data ?? []).map((r: any) => r.read_date));
    let s = 0; const d = new Date();
    while (dates.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }, [totalQ.data]);

  // unique surahs touched as a "khatm" proxy
  const surahsTouched = useMemo(() => new Set((totalQ.data ?? []).map((r: any) => r.surah)).size, [totalQ.data]);

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Qur'an</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">القرآن الكريم</h1>
      </header>

      {/* Daily goal hero */}
      <section className="glass-card rounded-3xl p-5 flex items-center gap-5">
        <ProgressRing value={goalPct} size={84} stroke={8}>
          <div className="text-center">
            <p className="text-lg font-bold leading-none">{ayahsToday}</p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">ayāt</p>
          </div>
        </ProgressRing>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Daily goal</p>
          <p className="mt-0.5 text-sm font-semibold">{ayahsToday} of {DAILY_AYAH_GOAL} ayāt</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Streak" value={`${streak}d`} />
            <Stat label="Surahs" value={`${surahsTouched}/114`} />
          </div>
        </div>
      </section>

      {last && (
        <button onClick={() => onOpen(last.surah, last.ayah)}
          className="w-full hero-gradient rounded-3xl p-5 text-left shadow-2xl shadow-primary/30 active:scale-[0.99] transition">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">Continue reading</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold truncate">{lastSurah?.englishName ?? `Surah ${last.surah}`}</p>
              <p className="text-sm opacity-80">Ayah {last.ayah}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/30">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </button>
      )}

      <div className="flex rounded-full bg-surface p-1 text-sm">
        {(["surahs", "bookmarks"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-9 rounded-full capitalize ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "surahs" && (
        <>
          <div className="flex items-center gap-2 rounded-2xl bg-input/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search surah"
              className="flex-1 h-11 bg-transparent text-sm outline-none" />
          </div>

          {surahsQ.isLoading && <p className="text-center text-xs text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</p>}

          <ul className="space-y-1.5">
            {filtered.map(s => (
              <li key={s.number}>
                <button onClick={() => onOpen(s.number)}
                  className="w-full glass-card rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary font-semibold text-sm">{s.number}</div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{s.englishName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.englishNameTranslation} · {s.numberOfAyahs} ayāt · {s.revelationType}</p>
                  </div>
                  <p className="font-quran text-2xl shrink-0">{s.name}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "bookmarks" && (
        <ul className="space-y-2">
          {(bookmarksQ.data ?? []).map((b: any) => {
            const s = (surahsQ.data ?? []).find(x => x.number === b.surah);
            return (
              <li key={b.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                <button onClick={() => onOpen(b.surah, b.ayah)} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{s?.englishName ?? `Surah ${b.surah}`} · Ayah {b.ayah}</p>
                </button>
                <button onClick={() => delBm.mutate(b.id)} className="grid h-8 w-8 place-items-center rounded-xl bg-surface">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </li>
            );
          })}
          {(!bookmarksQ.data || bookmarksQ.data.length === 0) && (
            <p className="text-center text-xs text-muted-foreground py-8">No bookmarks yet.</p>
          )}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

/* ───────────── Reader ───────────── */

function Reader({ surah, initialAyah, onBack }: { surah: number; initialAyah: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [fontSize, setFontSize] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("quran_fs") : null;
    return v ? Number(v) : 30;
  });
  const [tajweed, setTajweed] = useState<boolean>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("quran_tj") : null;
    return v ? v === "1" : true;
  });
  useEffect(() => { localStorage.setItem("quran_fs", String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("quran_tj", tajweed ? "1" : "0"); }, [tajweed]);

  const surahsQ = useQuery({ queryKey: ["surahs"], queryFn: fetchSurahs, staleTime: Infinity });
  const meta: Surah | undefined = (surahsQ.data ?? []).find(s => s.number === surah);

  const ayahsQ = useQuery({
    queryKey: ["surah_ayahs", surah],
    queryFn: () => fetchSurahAyahs(surah),
    staleTime: Infinity,
  });

  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*")).data ?? [],
  });
  const bmSet = useMemo(
    () => new Set((bookmarksQ.data ?? []).filter((b: any) => b.surah === surah).map((b: any) => b.ayah)),
    [bookmarksQ.data, surah],
  );

  const [currentAyah, setCurrentAyah] = useState(initialAyah);
  const maxReachedRef = useRef(initialAyah);

  // Persist last-read + log reading progress for today
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("quran_reading_state").upsert({
        user_id: user.id, surah, ayah: currentAyah, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      const newMax = Math.max(maxReachedRef.current, currentAyah);
      if (newMax > maxReachedRef.current) {
        const delta = newMax - maxReachedRef.current;
        maxReachedRef.current = newMax;
        // Insert daily session row capturing how many ayāt advanced
        await supabase.from("quran_progress").insert({
          user_id: user.id, surah, ayah: delta, read_date: todayISO(),
        });
        qc.invalidateQueries({ queryKey: ["quran_progress_today"] });
        qc.invalidateQueries({ queryKey: ["quran_progress_total"] });
      }
      qc.invalidateQueries({ queryKey: ["quran_state"] });
    }, 1200);
    return () => clearTimeout(t);
  }, [surah, currentAyah, qc]);

  useEffect(() => {
    if (!ayahsQ.data) return;
    const el = document.getElementById(`ayah-${initialAyah}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "auto", block: "start" }), 50);
  }, [ayahsQ.data, initialAyah]);

  useEffect(() => {
    if (!ayahsQ.data) return;
    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number((visible.target as HTMLElement).dataset.ayah);
        if (n) setCurrentAyah(n);
      }
    }, { threshold: [0.4, 0.7] });
    document.querySelectorAll("[data-ayah]").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [ayahsQ.data]);

  const toggleBookmark = useMutation({
    mutationFn: async (ayah: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      const existing = (bookmarksQ.data ?? []).find((b: any) => b.surah === surah && b.ayah === ayah);
      if (existing) await supabase.from("quran_bookmarks").delete().eq("id", (existing as any).id);
      else await supabase.from("quran_bookmarks").insert({ user_id: user!.id, surah, ayah });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }); },
  });

  const total = meta?.numberOfAyahs ?? 1;
  const pct = Math.round((currentAyah / total) * 100);

  return (
    <div className="quran-page flex flex-col h-full">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Surah {surah}</p>
            <p className="text-sm font-semibold truncate">
              {meta?.englishName ?? "…"} · <span className="font-quran text-base">{meta?.name ?? ""}</span>
            </p>
          </div>
          <button
            onClick={() => setTajweed(v => !v)}
            className={`grid h-10 w-10 place-items-center rounded-xl ${tajweed ? "bg-primary/20 text-primary" : "bg-surface/70 text-muted-foreground"}`}
            title="Toggle tajweed colours"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFontSize(s => Math.max(22, s - 2))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70"
            title="Smaller text"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFontSize(s => Math.min(48, s + 2))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70"
            title="Larger text"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{currentAyah}/{total}</span>
        </div>
      </header>

      <div className="flex-1 px-5 py-6 space-y-5">
        {surah !== 1 && surah !== 9 && (
          <p dir="rtl" className="text-center font-quran py-4" style={{ fontSize: fontSize + 6 }}>
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        )}

        {ayahsQ.isLoading && (
          <div className="py-16 text-center text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline" /> Loading…
          </div>
        )}

        {ayahsQ.error && (
          <p className="text-center text-sm text-destructive py-8">Failed to load. Check connection.</p>
        )}

        {(ayahsQ.data ?? []).map(a => {
          const isBm = bmSet.has(a.numberInSurah);
          return (
            <article
              key={a.numberInSurah}
              id={`ayah-${a.numberInSurah}`}
              data-ayah={a.numberInSurah}
              className="group"
            >
              <p
                dir="rtl"
                lang="ar"
                className="font-quran leading-[2.4] text-right text-foreground/95"
                style={{ fontSize }}
                dangerouslySetInnerHTML={{
                  __html:
                    (tajweed ? a.tajweedHtml : a.arabic) +
                    ` <span class="inline-grid place-items-center align-middle h-8 w-8 mx-1 rounded-full bg-primary/15 text-primary text-[12px] font-sans font-semibold">${toArabicNumeral(a.numberInSurah)}</span>`,
                }}
              />
              <div className="mt-3 flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition">
                <button
                  onClick={() => toggleBookmark.mutate(a.numberInSurah)}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-surface/70"
                >
                  <Bookmark className={`h-4 w-4 ${isBm ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
              </div>
              <div className="mt-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </article>
          );
        })}

        {ayahsQ.data && (
          <p className="text-center text-[10px] text-muted-foreground py-6 flex items-center justify-center gap-1.5">
            <Type className="h-3 w-3" /> Amiri Quran · Uthmani script
          </p>
        )}
      </div>
    </div>
  );
}

function toArabicNumeral(n: number): string {
  return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
}
