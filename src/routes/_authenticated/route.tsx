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
        <p className="text-base font-semibold">Нет доступа. Обратитесь к администратору</p>
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

/** Знак «Лидер»: янтарная плашка с буквой — единственное место, где янтарь крупным пятном. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-7 items-center justify-center rounded-md bg-signal text-[15px] font-bold leading-none text-sidebar ${className}`}
    >
      Л
    </span>
  );
}

function Nav({ profile, onSignOut, onNavigate }: { profile: CurrentProfile; onSignOut: () => void; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: count = 0 } = useAttentionCount();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-sidebar-primary-foreground">Лидер</div>
          <div className="text-[11px] text-sidebar-foreground/60">Контроль этапов работ</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {items.map((it) => {
          const active = path === it.to || path.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={`relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                active
                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-signal" />}
              <it.icon className="size-4 shrink-0 opacity-80" />
              <span className="flex-1">{it.label}</span>
              {"badge" in it && count > 0 && (
                <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-[11px] font-semibold leading-5 text-destructive-foreground">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="truncate text-sm font-medium text-sidebar-primary-foreground">{profile.full_name}</div>
        {profile.role_name && <div className="text-xs text-sidebar-foreground/60">{profile.role_name}</div>}
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 inline-flex items-center gap-2 rounded-md py-1 text-xs text-sidebar-foreground/70 transition-colors hover:text-sidebar-primary-foreground"
        >
          <LogOut className="size-3.5" /> Выйти
        </button>
      </div>
    </div>
  );
}

function Shell({ profile, onSignOut }: { profile: CurrentProfile; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 lg:block">
        <Nav profile={profile} onSignOut={onSignOut} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 bg-sidebar px-3 text-sidebar-primary-foreground lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sidebar-accent"
            aria-label="Меню"
          >
            <Menu className="size-5" />
          </button>
          <BrandMark className="size-6 text-[13px]" />
          <span className="text-sm font-semibold">Лидер</span>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <Nav profile={profile} onSignOut={onSignOut} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 lg:px-8 lg:py-6">
          <Outlet />
        </main>
        <OverdueDialog />
      </div>
    </div>
  );
}
