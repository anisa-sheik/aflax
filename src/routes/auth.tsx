import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/home", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/home` });
    if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/home", replace: true });
  };

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 pt-16 pb-10">
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-3xl hero-gradient grid place-items-center text-3xl font-bold shadow-2xl">ن</div>
          <h1 className="mt-6 text-3xl font-semibold">Nur</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your quiet daily companion for worship.</p>
        </div>

        <div className="glass-card mt-10 rounded-3xl p-6">
          <div className="flex rounded-full bg-surface p-1 text-sm">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 h-9 rounded-full transition ${mode === "signin" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
            >Sign in</button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 h-9 rounded-full transition ${mode === "signup" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
            >Create</button>
          </div>

          <form onSubmit={handleEmail} className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-12 rounded-2xl bg-input/60 px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              disabled={loading} type="submit"
              className="w-full h-12 rounded-2xl hero-gradient font-semibold text-sm shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <button
            onClick={handleGoogle} disabled={loading}
            className="w-full h-12 rounded-2xl bg-surface-elevated border border-border text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
