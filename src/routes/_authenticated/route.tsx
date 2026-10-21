import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, ClipboardList, BookOpen, History, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProfileContext, type CurrentProfile } from "@/lib/profile";
import { OverdueDialog, clearOverdueAck } from "@/components/OverdueDialog";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    return { userId: data.user.id };
  },
  component: AuthLayout,
});

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    clearOverdueAck();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

function AuthLayout() {
  const { userId } = Route.useRouteContext();
  const signOut = useSignOut();
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["current-profile", userId],
    queryFn: async (): Promise<CurrentProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role_code, roles(name, is_admin)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const role = (data as any).roles as { name: string; is_admin: boolean } | null;
      return {
        id: data.id,
        full_name: data.full_name,
        role_code: data.role_code,
        role_name: role?.name ?? "",
        is_admin: !!role?.is_admin,
      };
    },
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-base text-muted-foreground">Загрузка…</div>;
  }
  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
        <p className="text-lg font-semibold">Нет доступа. Обратитесь к администратору</p>
        <Button onClick={signOut} className="h-10 px-4 text-sm">Выйти</Button>
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <Shell profile={profile} onSignOut={signOut} />
    </ProfileContext.Provider>
  );
}

function useAttentionCount() {
  return useQuery({
    queryKey: ["requests-attention-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("v_requests" as any)
        .select("*", { count: "exact", head: true })
        .or("is_new.eq.true,is_overdue.eq.true");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

const items = [
  { to: "/objects", label: "Объекты", icon: Building2 },
  { to: "/requests", label: "Заявки", icon: ClipboardList, badge: true },
  { to: "/directories", label: "Справочники", icon: BookOpen },
  { to: "/history", label: "История", icon: History },
] as const;

function Nav({ profile, onSignOut, onNavigate }: { profile: CurrentProfile; onSignOut: () => void; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: count = 0 } = useAttentionCount();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-4 text-xl font-bold">Лидер</div>
      <nav className="flex-1 space-y-2 px-3">
        {items.map((it) => {
          const active = path === it.to || path.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={`flex items-center gap-4 rounded-md px-4 py-2.5 text-base font-medium transition-colors ${
                active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              }`}
            >
              <it.icon className="size-5 shrink-0" />
              <span className="flex-1">{it.label}</span>
              {"badge" in it && count > 0 && (
                <span className="min-w-8 rounded-full bg-destructive px-2.5 py-0.5 text-center text-sm font-bold text-destructive-foreground">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-4">
        <div>
          <div className="text-sm font-semibold leading-tight">{profile.full_name}</div>
          {profile.role_name && <div className="text-sm text-muted-foreground">{profile.role_name}</div>}
        </div>
        <Button variant="outline" onClick={onSignOut} className="h-9 w-full text-sm">
          <LogOut className="size-4" /> Выйти
        </Button>
      </div>
    </div>
  );
}

function Shell({ profile, onSignOut }: { profile: CurrentProfile; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border lg:block">
        <Nav profile={profile} onSignOut={onSignOut} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-2 lg:hidden">
          <Button variant="outline" onClick={() => setOpen(true)} className="h-9 px-4 text-sm" aria-label="Меню">
            <Menu className="size-4" /> Меню
          </Button>
          <span className="text-lg font-bold">Лидер</span>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <Nav profile={profile} onSignOut={onSignOut} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
        <OverdueDialog />
      </div>
    </div>
  );
}
