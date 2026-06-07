import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Save, Camera, Trash2, Loader2, Flame, BookOpen, Compass, Lock, Sparkles, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { getAvatarUrl, uploadAvatar, deleteAvatar, initialsOf } from "@/lib/avatar";
import { METHODS, MethodKey } from "@/lib/prayer-times";
import { ACHIEVEMENTS, ACHIEVEMENT_BY_CODE, syncAchievements, type AchievementCode } from "@/lib/achievements";
import { Timeline, type TimelineItem } from "@/components/Timeline";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState<MethodKey>("MWL");
  const [uploading, setUploading] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return { profile: data as any, email: user!.email, userId: user!.id };
    },
  });

  const avatarQ = useQuery({
    queryKey: ["avatar_url", profileQ.data?.profile?.avatar_url],
    queryFn: () => getAvatarUrl(profileQ.data?.profile?.avatar_url),
    enabled: !!profileQ.data,
  });

  useEffect(() => {
    const p = profileQ.data?.profile;
    if (p) {
      setFullName(p.full_name ?? "");
      setDisplayName(p.display_name ?? "");
      setUsername(p.username ?? "");
      setCity(p.city ?? "");
      setCountry(p.country ?? "");
      setMethod((p.preferred_method as MethodKey) ?? "MWL");
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
      const userId = profileQ.data!.userId;
      const { error } = await supabase.from("profiles").update({
        full_name: fullName || null,
        display_name: displayName || null,
        username: username || null,
        city: city || null,
        country: country || null,
        preferred_method: method,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (error) throw error;
      // also keep prayer_settings.method in sync
      await supabase.from("prayer_settings").upsert(
        { user_id: userId, method, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); qc.invalidateQueries({ queryKey: ["prayer_settings"] }); },
    onError: (e: any) => toast.error(e.message?.includes("username") ? "Username already taken" : (e.message ?? "Save failed")),
  });

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    try {
      setUploading(true);
      const userId = profileQ.data!.userId;
      // remove previous if it lives in our bucket
      const prev = profileQ.data?.profile?.avatar_url;
      if (prev && !prev.startsWith("http")) await deleteAvatar(prev);
      const path = await uploadAvatar(userId, file);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const removePhoto = async () => {
    const prev = profileQ.data?.profile?.avatar_url;
    if (!prev) return;
    if (!prev.startsWith("http")) await deleteAvatar(prev);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", profileQ.data!.userId);
    toast.success("Photo removed");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = displayName || fullName;
  const initials = initialsOf(name, profileQ.data?.email);
  const url = avatarQ.data;

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />

      <header className="flex flex-col items-center text-center">
        <div className="relative">
          <button onClick={onPickFile} disabled={uploading}
            className="h-24 w-24 rounded-3xl overflow-hidden hero-gradient grid place-items-center text-3xl font-bold shadow-2xl">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> :
              url ? <img src={url} alt={name || "Avatar"} className="h-full w-full object-cover" /> :
              <span>{initials}</span>}
          </button>
          <button onClick={onPickFile} disabled={uploading}
            className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-background">
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <h1 className="mt-4 text-xl font-semibold">{name || "Friend"}</h1>
        <p className="text-xs text-muted-foreground">{profileQ.data?.email}</p>
        {profileQ.data?.profile?.avatar_url && (
          <button onClick={removePhoto} className="mt-2 text-[11px] text-destructive flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Remove photo
          </button>
        )}
      </header>

      <section className="grid grid-cols-3 gap-2">
        <StatCard icon={Compass} label="Prayers" value={statsQ.data?.prayers ?? 0} />
        <StatCard icon={BookOpen} label="Minutes" value={statsQ.data?.minutes ?? 0} />
        <StatCard icon={Flame} label="Dhikr" value={statsQ.data?.dhikr ?? 0} />
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Personal details</h3>
        <Field label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Ahmed Yusuf" />
        <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Shown on Home" />
        <Field label="Username" value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="unique handle" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={city} onChange={setCity} placeholder="Copenhagen" />
          <Field label="Country" value={country} onChange={setCountry} placeholder="Denmark" />
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Calculation method</h3>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`h-10 rounded-xl text-xs font-semibold ${method === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>
              {m}
            </button>
          ))}
        </div>
      </section>

      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="w-full h-12 rounded-2xl hero-gradient font-semibold flex items-center justify-center gap-2">
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
      </button>

      <button onClick={signOut}
        className="w-full h-12 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold text-destructive flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full h-11 rounded-2xl bg-input/60 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
    </label>
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
