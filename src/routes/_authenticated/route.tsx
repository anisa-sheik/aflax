import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Compass, BookOpen, Target, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const tabs = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/prayer", icon: Compass, label: "Prayer" },
  { to: "/quran", icon: BookOpen, label: "Qur'an" },
  { to: "/goals", icon: Target, label: "Goals" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-[420px] md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[2.25rem] md:border md:border-border md:overflow-hidden md:shadow-2xl">
        <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
          <Outlet />
        </main>
        <nav className="sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-xl">
          <div className="grid grid-cols-5 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to}
                  className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition ${active ? "tab-active" : "text-muted-foreground"}`}>
                  <span className={`grid h-9 w-12 place-items-center rounded-2xl transition ${active ? "bg-primary/15" : ""}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
