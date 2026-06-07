import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bookmark, ChevronLeft, ChevronRight, Loader2, Menu, X, BookOpen,
  Sparkles, Minus, Plus, Search, Target, Trash2,
} from "lucide-react";
import {
  fetchSurahs, fetchPage, type Ayah, type Surah,
  TOTAL_PAGES, SURAH_START_PAGE, JUZ_START_PAGE,
} from "@/lib/quran-api";

export const Route = createFileRoute("/_authenticated/quran")({
  component: QuranScreen,
});

const FS_KEY = "quran_mushaf_fs";
const TJ_KEY = "quran_mushaf_tj";
const GOAL_KEY = "quran_khatm_days";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function arabicNum(n: number) { return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]); }

/* ───────────────────────────────────────── Root ───────────────────────────────────────── */

function QuranScreen() {
  const qc = useQueryClient();

  const stateQ = useQuery({
    queryKey: ["quran_state"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("quran_reading_state").select("*").eq("user_id", user.id).maybeSingle();
      return data as { surah: number; ayah: number } | null;
    },
  });

  const [page, setPage] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  // Initialise page from last reading state (once)
  useEffect(() => {
    if (page !== null) return;
    if (stateQ.isLoading) return;
    const s = stateQ.data;
    const p = s ? (SURAH_START_PAGE[s.surah] ?? 1) : 1;
    setPage(p);
  }, [stateQ.data, stateQ.isLoading, page]);

  const [fontSize, setFontSize] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(FS_KEY) : null;
    return v ? Number(v) : 30;
  });
  const [tajweed, setTajweed] = useState<boolean>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(TJ_KEY) : null;
    return v ? v === "1" : true;
  });
  useEffect(() => { localStorage.setItem(FS_KEY, String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem(TJ_KEY, tajweed ? "1" : "0"); }, [tajweed]);

  if (page === null) {
    return (
      <div className="h-full grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mushaf-shell relative h-full">
      <MushafPage
        page={page}
        fontSize={fontSize}
        tajweed={tajweed}
        chromeHidden={chromeHidden}
        onToggleChrome={() => setChromeHidden(v => !v)}
        onMenu={() => setMenuOpen(true)}
        onPrev={() => setPage(p => Math.max(1, (p ?? 1) - 1))}
        onNext={() => setPage(p => Math.min(TOTAL_PAGES, (p ?? 1) + 1))}
        setTajweed={setTajweed}
        setFontSize={setFontSize}
      />

      {menuOpen && (
        <MushafMenu
          currentPage={page}
          onClose={() => setMenuOpen(false)}
          onJumpPage={(p) => { setPage(p); setMenuOpen(false); qc.invalidateQueries({ queryKey: ["quran_state"] }); }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────────────── Page ───────────────────────────────────────── */

function MushafPage({
  page, fontSize, tajweed, chromeHidden,
  onToggleChrome, onMenu, onPrev, onNext, setTajweed, setFontSize,
}: {
  page: number;
  fontSize: number;
  tajweed: boolean;
  chromeHidden: boolean;
  onToggleChrome: () => void;
  onMenu: () => void;
  onPrev: () => void;
  onNext: () => void;
  setTajweed: (fn: (v: boolean) => boolean) => void;
  setFontSize: (fn: (v: number) => number) => void;
}) {
  const qc = useQueryClient();
  const ayahsQ = useQuery({
    queryKey: ["mushaf_page", page],
    queryFn: () => fetchPage(page),
    staleTime: Infinity,
  });

  const ayahs: Ayah[] = ayahsQ.data ?? [];

  // Group consecutive ayahs by surah for headers within a page
  const groups = useMemo(() => {
    const out: { surah: Ayah["surah"]; ayahs: Ayah[] }[] = [];
    for (const a of ayahs) {
      const last = out[out.length - 1];
      if (last && last.surah.number === a.surah.number) last.ayahs.push(a);
      else out.push({ surah: a.surah, ayahs: [a] });
    }
    return out;
  }, [ayahs]);

  const firstAyah = ayahs[0];
  const juz = firstAyah?.juz;

  // Persist reading state + log progress (debounced on page change)
  const prevPageRef = useRef<number>(page);
  useEffect(() => {
    if (!firstAyah) return;
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("quran_reading_state").upsert({
        user_id: user.id,
        surah: firstAyah.surah.number,
        ayah: firstAyah.numberInSurah,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Log ayāt advanced when moving forward
      if (page > prevPageRef.current) {
        await supabase.from("quran_progress").insert({
          user_id: user.id,
          surah: firstAyah.surah.number,
          ayah: ayahs.length,
          read_date: todayISO(),
        });
        qc.invalidateQueries({ queryKey: ["quran_progress_today"] });
        qc.invalidateQueries({ queryKey: ["quran_progress_total"] });
        qc.invalidateQueries({ queryKey: ["khatm_pages"] });
      }
      prevPageRef.current = page;
      qc.invalidateQueries({ queryKey: ["quran_state"] });
    }, 700);
    return () => clearTimeout(t);
  }, [page, firstAyah, ayahs.length, qc]);

  // Bookmark current page (first ayah on page)
  const bookmarksQ = useQuery({
    queryKey: ["quran_bookmarks"],
    queryFn: async () => (await supabase.from("quran_bookmarks").select("*")).data ?? [],
  });
  const isBookmarked = useMemo(() => {
    if (!firstAyah) return false;
    return (bookmarksQ.data ?? []).some((b: any) =>
      b.surah === firstAyah.surah.number && b.ayah === firstAyah.numberInSurah);
  }, [bookmarksQ.data, firstAyah]);

  const toggleBm = useMutation({
    mutationFn: async () => {
      if (!firstAyah) return;
      const { data: { user } } = await supabase.auth.getUser();
      const existing = (bookmarksQ.data ?? []).find((b: any) =>
        b.surah === firstAyah.surah.number && b.ayah === firstAyah.numberInSurah);
      if (existing) await supabase.from("quran_bookmarks").delete().eq("id", (existing as any).id);
      else await supabase.from("quran_bookmarks").insert({
        user_id: user!.id, surah: firstAyah.surah.number, ayah: firstAyah.numberInSurah,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quran_bookmarks"] }),
  });

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
              {firstAyah ? `Juz ${juz}` : "—"}
            </p>
            <p className="text-sm font-semibold truncate">
              {firstAyah ? (
                <>
                  {firstAyah.surah.englishName} ·{" "}
                  <span className="font-quran text-base">{firstAyah.surah.name}</span>
                </>
              ) : "…"}
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

      {/* Mushaf page surface */}
      <button
        onClick={onToggleChrome}
        className="flex-1 overflow-y-auto text-left cursor-default"
        aria-label="Toggle reader chrome"
      >
        <div className="mushaf-paper mx-3 my-3 rounded-2xl p-5 md:p-7 min-h-full">
          {ayahsQ.isLoading && (
            <div className="py-24 text-center text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline" /> Loading page {page}…
            </div>
          )}
          {ayahsQ.error && (
            <p className="text-center text-sm text-destructive py-10">Could not load page. Check connection.</p>
          )}

          {groups.map((g, gi) => {
            const startsAtAyahOne = g.ayahs[0]?.numberInSurah === 1;
            const showBasmala = startsAtAyahOne && g.surah.number !== 1 && g.surah.number !== 9;
            return (
              <div key={gi}>
                {/* Surah header within the page */}
                <div className="my-4 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Surah {g.surah.number}
                  </span>
                  <span className="font-quran text-xl">{g.surah.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {g.surah.englishName}
                  </span>
                </div>

                {showBasmala && (
                  <p dir="rtl" className="text-center font-quran py-2" style={{ fontSize: fontSize + 4 }}>
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                )}

                {/* Continuous justified Mushaf text */}
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-quran text-justify text-foreground/95"
                  style={{ fontSize, lineHeight: 2.25, textAlignLast: "center" as any }}
                  dangerouslySetInnerHTML={{
                    __html: g.ayahs.map(a =>
                      `${tajweed ? a.tajweedHtml : a.arabic}` +
                      `<span class="ayah-end">${arabicNum(a.numberInSurah)}</span>`
                    ).join(" "),
                  }}
                />
              </div>
            );
          })}

          {/* Page footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px flex-1 bg-border/60 max-w-[80px]" />
            <span>Page {page} · {arabicNum(page)}</span>
            <span className="h-px flex-1 bg-border/60 max-w-[80px]" />
          </div>
        </div>
      </button>

      {/* Bottom chrome */}
      <footer className={`shrink-0 transition-all duration-300 ${chromeHidden ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100"}`}>
        <div className="px-4 pb-6 pt-2 flex items-center gap-2">
          <button onClick={onNext} className="grid h-11 w-11 place-items-center rounded-xl bg-surface/70" title="Previous page (right→left)">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-2xl bg-surface/60 px-3 py-2">
            <button onClick={() => setFontSize(s => Math.max(20, s - 2))} className="grid h-8 w-8 place-items-center rounded-lg bg-background/50">
              <Minus className="h-4 w-4" />
            </button>
            <button onClick={() => setFontSize(s => Math.min(48, s + 2))} className="grid h-8 w-8 place-items-center rounded-lg bg-background/50">
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Page</p>
              <p className="text-sm font-semibold tabular-nums">{page} / {TOTAL_PAGES}</p>
            </div>
            <button
              onClick={() => setTajweed(v => !v)}
              className={`grid h-8 w-8 place-items-center rounded-lg ${tajweed ? "bg-primary/20 text-primary" : "bg-background/50 text-muted-foreground"}`}
              title="Toggle tajweed"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          <button onClick={onPrev} className="grid h-11 w-11 place-items-center rounded-xl bg-surface/70" title="Next page">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────── Menu / Index ─────────────────────────────────────── */

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
              const s = (surahsQ.data ?? []).find((x: Surah) => x.number === b.surah);
              return (
                <li key={b.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                  <button onClick={() => onJumpPage(SURAH_START_PAGE[b.surah] ?? 1)}
                    className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {s?.englishName ?? `Surah ${b.surah}`} · Ayah {b.ayah}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Page {SURAH_START_PAGE[b.surah] ?? "?"}</p>
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

/* ─────────────────────────────────────── Khatm tracker ─────────────────────────────────────── */

function KhatmPanel({ currentPage }: { currentPage: number }) {
  const [goal, setGoal] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(GOAL_KEY) : null;
    return v ? Number(v) : 30;
  });
  useEffect(() => { localStorage.setItem(GOAL_KEY, String(goal)); }, [goal]);

  // pagesCompleted ≈ farthest page reached. We use reading_state surah → page mapping
  // plus the current visible page as the floor.
  const stateQ = useQuery({
    queryKey: ["khatm_pages"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { reached: currentPage };
      const { data } = await supabase
        .from("quran_reading_state").select("surah,ayah").eq("user_id", user.id).maybeSingle();
      const reachedFromState = data ? (SURAH_START_PAGE[(data as any).surah] ?? 1) : 1;
      return { reached: Math.max(reachedFromState, currentPage) };
    },
  });

  const reached = stateQ.data?.reached ?? currentPage;
  const pct = Math.round((reached / TOTAL_PAGES) * 100);
  const pagesPerDay = Math.max(1, Math.ceil((TOTAL_PAGES - reached) / Math.max(1, goal)));
  const juzReached = Math.ceil(reached / 20.13);

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
