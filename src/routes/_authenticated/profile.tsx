import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, MapPin, Save, Flame, BookOpen, Compass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return { profile: data, email: user!.email };
    },
  });

  useEffect(() => {
    if (profileQ.data?.profile) {
      setName(profileQ.data.profile.display_name ?? "");
      setCity(profileQ.data.profile.city ?? "");
    }
  }, [profileQ.data]);

  const statsQ = useQuery({
    queryKey: ["profile_stats"],
    queryFn: async () => {
      const [p, q, d] = await Promise.all([
        supabase.from("prayer_logs").select("id", { count: "exact", head: true }),
        supabase.from("quran_progress").select("minutes_read"),
        supabase.from("dhikr_sessions").select("count"),
      ]);
      return {
        prayers: p.count ?? 0,
        minutes: (q.data ?? []).reduce((s: number, r: any) => s + (r.minutes_read || 0), 0),
        dhikr: (d.data ?? []).reduce((s: number, r: any) => s + (r.count || 0), 0),
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ display_name: name, city, updated_at: new Date().toISOString() }).eq("id", user!.id);
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (name || profileQ.data?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      <header className="flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-3xl hero-gradient grid place-items-center text-3xl font-bold shadow-2xl">{initials}</div>
        <h1 className="mt-4 text-xl font-semibold">{name || "Friend"}</h1>
        <p className="text-xs text-muted-foreground">{profileQ.data?.email}</p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <StatCard icon={Compass} label="Prayers" value={statsQ.data?.prayers ?? 0} />
        <StatCard icon={BookOpen} label="Minutes" value={statsQ.data?.minutes ?? 0} />
        <StatCard icon={Flame} label="Dhikr" value={statsQ.data?.dhikr ?? 0} />
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Your details</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name"
          className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm outline-none" />
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (for prayer times)"
            className="w-full h-12 rounded-2xl bg-input/60 pl-11 pr-4 text-sm outline-none" />
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="w-full h-12 rounded-2xl hero-gradient font-semibold flex items-center justify-center gap-2">
          <Save className="h-4 w-4" /> Save
        </button>
      </section>

      <button onClick={signOut}
        className="w-full h-12 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold text-destructive flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-3 flex flex-col items-center text-center">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-1.5 text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
