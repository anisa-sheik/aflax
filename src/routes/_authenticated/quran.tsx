import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bookmark, ChevronLeft, ChevronRight, Loader2, Menu, X, BookOpen,
  Search, Target, Trash2, Eye, EyeOff,
} from "lucide-react";
import {
  fetchSurahs, type Surah,
  TOTAL_PAGES, SURAH_START_PAGE, JUZ_START_PAGE,
  mushafImageUrl, pageToSurah, pageToJuz,
} from "@/lib/quran-api";

export const Route = createFileRoute("/_authenticated/quran")({
  component: QuranScreen,
});

const GOAL_KEY = "quran_khatm_days";
function todayISO() { return new Date().toISOString().slice(0, 10); }
function arabicNum(n: number) { return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]); }

/* ───────────────────────────────── Root ───────────────────────────────── */

function QuranScreen() {
  const qc = useQueryClient();

  const stateQ = useQuery({
    queryKey: ["quran_state"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("quran_reading_state").select("*").eq("user_id", user.id).maybeSingle();
      return data as { surah: number; ayah: number; page?: number } | null;
    },
  });

  const surahsQ = useQuery({ queryKey: ["surahs"], queryFn: fetchSurahs, staleTime: Infinity });

  const [page, setPage] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    if (page !== null || stateQ.isLoading) return;
    const s = stateQ.data;
    const p = (s as any)?.page ?? (s ? (SURAH_START_PAGE[s.surah] ?? 1) : 1);
    setPage(p);
  }, [stateQ.data, stateQ.isLoading, page]);

  if (page === null) {
    return (
      <div className="h-full grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mushaf-shell relative h-full">
      <MushafReader
        page={page}
        surahs={surahsQ.data ?? []}
        chromeHidden={chromeHidden}
        onToggleChrome={() => setChromeHidden(v => !v)}
        onMenu={() => setMenuOpen(true)}
        onPrev={() => setPage(p => Math.max(1, (p ?? 1) - 1))}
        onNext={() => setPage(p => Math.min(TOTAL_PAGES, (p ?? 1) + 1))}
      />

      {menuOpen && (
        <MushafMenu
          currentPage={page}
          onClose={() => setMenuOpen(false)}
          onJumpPage={(p) => {
            setPage(p);
            setMenuOpen(false);
            qc.invalidateQueries({ queryKey: ["quran_state"] });
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────── Mushaf Reader ───────────────────────────────── */

function MushafReader({
  page, surahs, chromeHidden, onToggleChrome, onMenu, onPrev, onNext,
}: {
  page: number;
  surahs: Surah[];
  chromeHidden: boolean;
  onToggleChrome: () => void;
  onMenu: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();

  const surahNum = pageToSurah(page);
  const juz = pageToJuz(page);
  const surah = surahs.find(s => s.number === surahNum);

  // Persist reading + log progress on page change
  const prevPageRef = useRef<number>(page);
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("quran_reading_state").upsert({
        user_id: user.id,
        surah: surahNum,
        ayah: 1,
        page,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (page > prevPageRef.current) {
        await supabase.from("quran_progress").insert({
          user_id: user.id,
          surah: surahNum,
          ayah: 15, // average ayāt per Mushaf page
          read_date: todayISO(),
        });
        qc.invalidateQueries({ queryKey: ["quran_progress_today"] });
        qc.invalidateQueries({ queryKey: ["quran_progress_total"] });
        qc.invalidateQueries({ queryKey: ["khatm_pages"] });
      }
      prevPageRef.current = page;
      qc.invalidateQueries({ queryKey: ["quran_state"] });
    }, 600);
    return () => clearTimeout(t);
  }, [page, surahNum, qc]);

  // Bookmarks (per-page)
  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*")).data ?? [],
  });
  const isBookmarked = useMemo(
    () => (bookmarksQ.data ?? []).some((b: any) => (b.page ?? SURAH_START_PAGE[b.surah]) === page),
    [bookmarksQ.data, page],
  );
  const toggleBm = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const existing = (bookmarksQ.data ?? []).find(
        (b: any) => (b.page ?? SURAH_START_PAGE[b.surah]) === page,
      );
      if (existing) await supabase.from("quran_bookmarks").delete().eq("id", (existing as any).id);
      else await supabase.from("quran_bookmarks").insert({
        user_id: user.id, surah: surahNum, ayah: 1, page,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }),
  });

  // Swipe navigation
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    // Mushaf RTL: swipe left → next page, swipe right → previous page
    if (dx < 0) onNext(); else onPrev();
  }

  // Preload neighbouring pages
  useEffect(() => {
    [page - 1, page + 1].forEach(p => {
      if (p < 1 || p > TOTAL_PAGES) return;
      const i = new Image();
      i.src = mushafImageUrl(p);
    });
  }, [page]);

  const [imgLoading, setImgLoading] = useState(true);
  useEffect(() => { setImgLoading(true); }, [page]);

  return (
    <div className="flex flex-col h-full">
      {/* Top chrome */}
      <header className={`shrink-0 transition-all duration-300 ${chromeHidden ? "opacity-0 pointer-events-none -translate-y-2" : "opacity-100"}`}>
        <div className="flex items-center gap-2 px-4 pt-12 pb-3">
          <button onClick={onMenu} className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Juz {juz}
            </p>
            <p className="text-sm font-semibold truncate">
              {surah ? (
                <>{surah.englishName} · <span className="font-quran text-base">{surah.name}</span></>
              ) : `Surah ${surahNum}`}
            </p>
          </div>
          <button
            onClick={() => toggleBm.mutate()}
            className={`grid h-10 w-10 place-items-center rounded-xl ${isBookmarked ? "bg-accent/20 text-accent" : "bg-surface/70"}`}
          >
            <Bookmark className={`h-5 w-5 ${isBookmarked ? "fill-accent" : ""}`} />
          </button>
        </div>
      </header>

      {/* Mushaf page image */}
      <div
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onToggleChrome}
      >
        {imgLoading && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <img
          key={page}
          src={mushafImageUrl(page)}
          alt={`Mushaf page ${page}`}
          onLoad={() => setImgLoading(false)}
          onError={() => setImgLoading(false)}
          className={`h-full w-full object-contain px-2 py-2 select-none transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
          draggable={false}
        />

        {/* Edge tap zones */}
        <button
          aria-label="Next page"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute inset-y-0 left-0 w-1/5"
        />
        <button
          aria-label="Previous page"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute inset-y-0 right-0 w-1/5"
        />
      </div>

      {/* Bottom chrome */}
      <footer className={`shrink-0 transition-all duration-300 ${chromeHidden ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100"}`}>
        <div className="px-4 pb-6 pt-2 flex items-center gap-2">
          <button onClick={onNext} className="grid h-11 w-11 place-items-center rounded-xl bg-surface/70" title="Next page">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-2xl bg-surface/60 px-3 py-2">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleChrome(); }}
              className="grid h-8 w-8 place-items-center rounded-lg bg-background/50"
              title="Toggle chrome"
            >
              {chromeHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Page</p>
              <p className="text-sm font-semibold tabular-nums">
                {page} · {arabicNum(page)} / {TOTAL_PAGES}
              </p>
            </div>
            <button onClick={onMenu} className="grid h-8 w-8 place-items-center rounded-lg bg-background/50">
              <Search className="h-4 w-4" />
            </button>
          </div>
          <button onClick={onPrev} className="grid h-11 w-11 place-items-center rounded-xl bg-surface/70" title="Previous page">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────── Menu / Index ─────────────────────────────── */

function MushafMenu({
  currentPage, onClose, onJumpPage,
}: { currentPage: number; onClose: () => void; onJumpPage: (page: number) => void }) {
  const [tab, setTab] = useState<"surah" | "juz" | "page" | "bookmarks" | "khatm">("surah");
  const [q, setQ] = useState("");
  const surahsQ = useQuery({ queryKey: ["surahs"], queryFn: fetchSurahs, staleTime: Infinity });
  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const qc = useQueryClient();
  const delBm = useMutation({
    mutationFn: async (id: string) => { await supabase.from("quran_bookmarks").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }),
  });

  const filteredSurahs = useMemo(() => {
    const list = surahsQ.data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(x =>
      x.englishName.toLowerCase().includes(s) ||
      x.englishNameTranslation.toLowerCase().includes(s) ||
      String(x.number) === s);
  }, [surahsQ.data, q]);

  const [pageInput, setPageInput] = useState(String(currentPage));

  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-xl flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border/40">
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mushaf index</p>
          <h2 className="text-base font-semibold">القرآن الكريم</h2>
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="flex gap-1 rounded-full bg-surface/60 p-1 text-[11px]">
          {(["surah","juz","page","bookmarks","khatm"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 h-8 rounded-full capitalize ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {tab === "surah" && (
          <>
            <div className="flex items-center gap-2 rounded-2xl bg-input/60 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search surah"
                className="flex-1 h-11 bg-transparent text-sm outline-none" />
            </div>
            <ul className="space-y-1.5">
              {filteredSurahs.map((s: Surah) => (
                <li key={s.number}>
                  <button onClick={() => onJumpPage(SURAH_START_PAGE[s.number] ?? 1)}
                    className="w-full glass-card rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary font-semibold text-sm">{s.number}</div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold truncate">{s.englishName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {s.englishNameTranslation} · {s.numberOfAyahs} ayāt · p.{SURAH_START_PAGE[s.number]}
                      </p>
                    </div>
                    <p className="font-quran text-2xl shrink-0">{s.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "juz" && (
          <ul className="grid grid-cols-2 gap-2">
            {Object.entries(JUZ_START_PAGE).map(([juz, p]) => (
              <li key={juz}>
                <button onClick={() => onJumpPage(p)}
                  className="w-full glass-card rounded-2xl p-3 text-left active:scale-[0.99] transition">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Juz {juz}</p>
                  <p className="text-sm font-semibold">Page {p}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "page" && (
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Jump to page</p>
              <p className="text-sm text-muted-foreground mt-1">1 – {TOTAL_PAGES} (Madinah Mushaf)</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={TOTAL_PAGES}
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                className="flex-1 h-11 rounded-xl bg-input/60 px-3 text-sm outline-none"
              />
              <button
                onClick={() => {
                  const n = Math.max(1, Math.min(TOTAL_PAGES, Number(pageInput) || 1));
                  onJumpPage(n);
                }}
                className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >Go</button>
            </div>
          </div>
        )}

        {tab === "bookmarks" && (
          <ul className="space-y-2">
            {(bookmarksQ.data ?? []).map((b: any) => {
              const bmPage = b.page ?? SURAH_START_PAGE[b.surah] ?? 1;
              const s = (surahsQ.data ?? []).find((x: Surah) => x.number === b.surah);
              return (
                <li key={b.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                  <button onClick={() => onJumpPage(bmPage)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">
                      Page {bmPage} · Juz {pageToJuz(bmPage)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s?.englishName ?? `Surah ${b.surah}`}
                    </p>
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

        {tab === "khatm" && <KhatmPanel currentPage={currentPage} />}
      </div>
    </div>
  );
}

/* ───────────────────────────── Khatm tracker ───────────────────────────── */

import { Heatmap } from "@/components/Heatmap";

function KhatmPanel({ currentPage }: { currentPage: number }) {
  const [goal, setGoal] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(GOAL_KEY) : null;
    return v ? Number(v) : 30;
  });
  useEffect(() => { localStorage.setItem(GOAL_KEY, String(goal)); }, [goal]);

  const stateQ = useQuery({
    queryKey: ["khatm_pages"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { reached: currentPage };
      const { data } = await supabase
        .from("quran_reading_state").select("surah,ayah,page").eq("user_id", user.id).maybeSingle();
      const reachedFromState = (data as any)?.page ?? (data ? (SURAH_START_PAGE[(data as any).surah] ?? 1) : 1);
      return { reached: Math.max(reachedFromState, currentPage) };
    },
  });

  const heatmapQ = useQuery({
    queryKey: ["quran_heatmap_365"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 365);
      const { data } = await supabase
        .from("quran_progress").select("ayah,read_date")
        .gte("read_date", since.toISOString().slice(0, 10));
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) {
        map[r.read_date] = (map[r.read_date] ?? 0) + (r.ayah ?? 0);
      }
      return map;
    },
  });

  const reached = stateQ.data?.reached ?? currentPage;
  const pct = Math.round((reached / TOTAL_PAGES) * 100);
  const pagesPerDay = Math.max(1, Math.ceil((TOTAL_PAGES - reached) / Math.max(1, goal)));
  const juzReached = pageToJuz(reached);
  const presets = [30, 60, 90];

  return (
    <div className="space-y-3">
      <div className="hero-gradient rounded-3xl p-5 shadow-2xl shadow-primary/20">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">Khatm progress</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="text-5xl font-bold tabular-nums">{pct}%</p>
          <p className="text-sm opacity-80 mb-1">of the Qur'an</p>
        </div>
        <div className="mt-4 h-2 rounded-full bg-black/30 overflow-hidden">
          <div className="h-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat tone="dark" label="Pages" value={`${reached}/${TOTAL_PAGES}`} />
          <Stat tone="dark" label="Juz" value={`${Math.min(30, juzReached)}/30`} />
          <Stat tone="dark" label="Goal" value={`${goal}d`} />
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Reading activity</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 365 days</p>
        </div>
        <Heatmap data={heatmapQ.data ?? {}} tint="primary" />
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Khatm goal</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {presets.map(p => (
            <button key={p} onClick={() => setGoal(p)}
              className={`h-10 rounded-xl text-sm font-semibold ${goal === p ? "bg-primary text-primary-foreground" : "bg-surface/70 text-muted-foreground"}`}>
              {p}d
            </button>
          ))}
          <input
            type="number" min={1} max={365} value={goal}
            onChange={e => setGoal(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            className="h-10 rounded-xl bg-input/60 px-3 text-sm outline-none text-center"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Read <span className="font-semibold text-foreground">{pagesPerDay} pages/day</span> to finish in {goal} days.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-primary" />
        <p className="text-xs text-muted-foreground">
          Progress is saved automatically as you turn pages.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "light" }: { label: string; value: string; tone?: "light" | "dark" }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${tone === "dark" ? "bg-black/25" : "bg-surface/60"}`}>
      <p className="text-[9px] uppercase tracking-widest opacity-75">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}
