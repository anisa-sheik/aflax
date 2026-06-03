import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/home", replace: true });
      else navigate({ to: "/auth", replace: true });
      setChecking(false);
    })();
  }, [navigate]);
  return (
    <div className="app-shell flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-3xl hero-gradient grid place-items-center text-2xl font-bold shadow-2xl">ن</div>
        <p className="text-sm text-muted-foreground">{checking ? "Loading…" : ""}</p>
      </div>
    </div>
  );
}
