import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus } from "lucide-react";
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

function QuranScreen() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [surah, setSurah] = useState(67);
  const [ayah, setAyah] = useState(1);
  const [minutes, setMinutes] = useState(10);

  const progressQ = useQuery({
    queryKey: ["quran_progress"],
    queryFn: async () => {
      const { data } = await supabase.from("quran_progress").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const totalMin = (progressQ.data ?? []).reduce((s, r: any) => s + (r.minutes_read || 0), 0);
  const last = progressQ.data?.[0] as any;

  const log = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("quran_progress").insert({ user_id: user!.id, surah, ayah, minutes_read: minutes });
    },
    onSuccess: () => { toast.success("Logged 🌙"); setOpen(false); qc.invalidateQueries({ queryKey: ["quran_progress"] }); },
  });

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Qur'an</p>
          <h1 className="mt-1 text-2xl font-semibold">Reading</h1>
        </div>
        <button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-2xl hero-gradient shadow-lg">
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <section className="hero-gradient rounded-3xl p-6 shadow-2xl shadow-primary/30">
        <p className="text-xs uppercase tracking-widest opacity-80">Continue where you left</p>
        <h2 className="mt-2 text-3xl font-bold">
          {last ? (SURAHS.find(s => s.n === last.surah)?.name ?? `Surah ${last.surah}`) : "Al-Mulk"}
        </h2>
        <p className="mt-1 text-sm opacity-80">Ayah {last?.ayah ?? 1}</p>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="opacity-80">{totalMin} min total</span>
          <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">{progressQ.data?.length ?? 0} sessions</span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Surahs</h3>
        <div className="space-y-2">
          {SURAHS.map((s) => (
            <div key={s.n} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary font-semibold text-sm">{s.n}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.ayat} ayat</p>
              </div>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-surface-elevated p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1 w-12 rounded-full bg-border" />
            <h3 className="text-lg font-semibold">Log reading session</h3>
            <div className="space-y-3">
              <select value={surah} onChange={(e) => setSurah(+e.target.value)} className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm">
                {SURAHS.map(s => <option key={s.n} value={s.n}>{s.n}. {s.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min={1} value={ayah} onChange={(e) => setAyah(+e.target.value)} placeholder="Ayah" className="h-12 rounded-2xl bg-input/60 px-4 text-sm" />
                <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(+e.target.value)} placeholder="Minutes" className="h-12 rounded-2xl bg-input/60 px-4 text-sm" />
              </div>
              <button disabled={log.isPending} onClick={() => log.mutate()} className="w-full h-12 rounded-2xl hero-gradient font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
