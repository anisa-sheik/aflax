import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, ChevronLeft, Search, Trash2, Play, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { fetchSurahs, fetchSurahAyahs, type Surah } from "@/lib/quran-api";

export const Route = createFileRoute("/_authenticated/quran")({
  component: QuranScreen,
});

function QuranScreen() {
  const [open, setOpen] = useState<{ surah: number; ayah?: number } | null>(null);
  return open ? (
    <Reader surah={open.surah} initialAyah={open.ayah ?? 1} onBack={() => setOpen(null)} />
  ) : (
    <SurahList onOpen={(s, a) => setOpen({ surah: s, ayah: a })} />
  );
}

/* ───────────── Surah list ───────────── */

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

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Qur'an</p>
        <h1 className="mt-1 text-2xl font-semibold">القرآن الكريم</h1>
      </header>

      {last && (
        <button onClick={() => onOpen(last.surah, last.ayah)}
          className="w-full hero-gradient rounded-3xl p-5 text-left shadow-2xl shadow-primary/30">
          <p className="text-xs uppercase tracking-widest opacity-80">Continue reading</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold">{lastSurah?.englishName ?? `Surah ${last.surah}`}</p>
              <p className="text-sm opacity-80">Ayah {last.ayah}</p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-black/25">
              <Play className="h-5 w-5" />
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

          {surahsQ.isLoading && <p className="text-center text-xs text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading surahs…</p>}

          <ul className="space-y-1.5">
            {filtered.map(s => (
              <li key={s.number}>
                <button onClick={() => onOpen(s.number)}
                  className="w-full glass-card rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary font-semibold text-sm">{s.number}</div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">{s.englishName}</p>
                    <p className="text-[11px] text-muted-foreground">{s.englishNameTranslation} · {s.numberOfAyahs} ayāt · {s.revelationType}</p>
                  </div>
                  <p className="font-display text-xl">{s.name}</p>
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
                <button onClick={() => onOpen(b.surah, b.ayah)} className="flex-1 text-left">
                  <p className="text-sm font-semibold">{s?.englishName ?? `Surah ${b.surah}`} · Ayah {b.ayah}</p>
                  {b.note && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.note}</p>}
                </button>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
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

/* ───────────── Reader ───────────── */

function Reader({ surah, initialAyah, onBack }: { surah: number; initialAyah: number; onBack: () => void }) {
  const qc = useQueryClient();
  const scrollerRef = useRef<HTMLDivElement>(null);

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
  const bmSet = useMemo(() => new Set((bookmarksQ.data ?? []).filter((b: any) => b.surah === surah).map((b: any) => b.ayah)), [bookmarksQ.data, surah]);

  // Persist last read position (debounced via current ayah tracking)
  const [currentAyah, setCurrentAyah] = useState(initialAyah);
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("quran_reading_state").upsert({
        user_id: user.id, surah, ayah: currentAyah, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      qc.invalidateQueries({ queryKey: ["quran_state"] });
    }, 800);
    return () => clearTimeout(t);
  }, [surah, currentAyah, qc]);

  // Scroll to initial ayah once loaded
  useEffect(() => {
    if (!ayahsQ.data) return;
    const el = document.getElementById(`ayah-${initialAyah}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "auto", block: "start" }), 50);
  }, [ayahsQ.data, initialAyah]);

  // Track which ayah is in view
  useEffect(() => {
    if (!ayahsQ.data) return;
    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number((visible.target as HTMLElement).dataset.ayah);
        if (n) setCurrentAyah(n);
      }
    }, { threshold: [0.3, 0.6] });
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

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-xl bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Surah {surah}</p>
          <p className="text-sm font-semibold">{meta?.englishName ?? "…"} · <span className="font-display">{meta?.name ?? ""}</span></p>
        </div>
        <span className="text-[11px] text-muted-foreground">Ayah {currentAyah}/{meta?.numberOfAyahs ?? "—"}</span>
      </header>

      <div ref={scrollerRef} className="flex-1 px-4 py-4 space-y-3">
        {surah !== 1 && surah !== 9 && (
          <p className="text-center font-display text-2xl py-4">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
        )}

        {ayahsQ.isLoading && (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline" /> Loading ayahs…
          </div>
        )}

        {ayahsQ.error && (
          <p className="text-center text-sm text-destructive py-8">Failed to load. Check connection.</p>
        )}

        {(ayahsQ.data ?? []).map(a => {
          const isBm = bmSet.has(a.numberInSurah);
          return (
            <article key={a.numberInSurah} id={`ayah-${a.numberInSurah}`} data-ayah={a.numberInSurah}
              className="glass-card rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">{a.numberInSurah}</span>
                <button onClick={() => toggleBookmark.mutate(a.numberInSurah)} className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
                  <Bookmark className={`h-4 w-4 ${isBm ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
              </div>
              <p dir="rtl" lang="ar" className="mt-3 font-display text-2xl leading-[2.2] text-right">{a.arabic}</p>
              {a.english && (
                <p className="mt-3 text-sm text-foreground/90 leading-relaxed">{a.english}</p>
              )}
              {a.scandinavian && (
                <p className="mt-2 text-sm text-muted-foreground italic leading-relaxed">{a.scandinavian}</p>
              )}
            </article>
          );
        })}

        {ayahsQ.data && (
          <p className="text-center text-[10px] text-muted-foreground py-4">
            Translations: English (Sahih Intl) · Swedish (Bernström) — used as Danish fallback
          </p>
        )}
      </div>
    </div>
  );
}
