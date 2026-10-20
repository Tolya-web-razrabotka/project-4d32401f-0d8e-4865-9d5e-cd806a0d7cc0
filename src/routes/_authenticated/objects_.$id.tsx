import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObject } from "@/components/objects/data";
import { ObjectHeader } from "@/components/objects/ObjectHeader";
import { useRequestTypes } from "@/components/directories/request-types/data";
import { StagesTable } from "@/components/stages/StagesTable";
import { StagesExport } from "@/components/stages/StagesExport";
import { HistoryFeed } from "@/components/history/HistoryFeed";
import { ObjectRequests } from "@/components/requests/ObjectRequests";

const TABS = ["stages", "requests", "members", "history"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/objects_/$id")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab; type?: string } => {
    const tab = TABS.find((t) => t === search["tab"]);
    const type = typeof search["type"] === "string" ? search["type"] : undefined;
    return { ...(tab ? { tab } : {}), ...(type ? { type } : {}) };
  },
  component: ObjectPage,
  head: () => ({ meta: [{ title: "Объект — Лидер" }] }),
});

const TAB_CLASS =
  "h-12 border px-5 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

function ObjectPage() {
  const { id } = Route.useParams();
  const { tab = "stages", type } = Route.useSearch();
  const navigate = useNavigate({ from: "/objects/$id" });
  const { is_admin } = useProfile();
  const { data: o, isLoading } = useObject(id);

  const go = (next: { tab: Tab; type?: string | undefined }) =>
    navigate({ search: { tab: next.tab, ...(next.type ? { type: next.type } : {}) }, replace: true });

  const back = (
    <Link to="/objects" className="mb-4 inline-flex items-center gap-2 text-lg text-primary hover:underline">
      <ArrowLeft className="size-5" /> К объектам
    </Link>
  );

  if (isLoading) return <div className="text-xl text-muted-foreground">Загрузка…</div>;
  if (!o) {
    return (
      <div>
        {back}
        <p className="py-10 text-xl text-muted-foreground">Объект не найден или у вас нет к нему доступа</p>
      </div>
    );
  }

  return (
    <div>
      {back}
      <ObjectHeader
        o={o}
        actions={
          is_admin && (
            <Button asChild variant="outline" className="h-12 text-lg">
              <Link to="/objects/$id/edit" params={{ id }}>
                <Pencil className="size-5" /> Редактировать
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <RequestTypeButtons
          objectId={id}
          activeType={tab === "requests" ? type : undefined}
          onPick={(t) => go({ tab: "requests", type: t })}
        />

        <Tabs value={tab} onValueChange={(v) => go({ tab: v as Tab })} className="min-w-0">
          <TabsList className="mb-5 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="stages" className={TAB_CLASS}>Этапы</TabsTrigger>
            <TabsTrigger value="requests" className={TAB_CLASS}>Заявки</TabsTrigger>
            <TabsTrigger value="members" className={TAB_CLASS}>Участники</TabsTrigger>
            <TabsTrigger value="history" className={TAB_CLASS}>История</TabsTrigger>
          </TabsList>
          <TabsContent value="stages">
            <StagesTable
              objectId={id}
              toolbar={(visible) => <StagesExport objectName={o.name} stages={visible} />}
            />
          </TabsContent>
          <TabsContent value="requests">
            <ObjectRequests objectId={id} typeId={type} onClearType={() => go({ tab: "requests" })} />
          </TabsContent>
          <TabsContent value="members">
            <MembersList objectId={id} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryFeed filter={{ objectId: id }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Крупные кнопки видов заявок с бейджами новых/просроченных по объекту (ТЗ 7.4). */
function RequestTypeButtons({
  objectId,
  activeType,
  onPick,
}: {
  objectId: string;
  activeType: string | undefined;
  onPick: (typeId: string) => void;
}) {
  const { data: types = [] } = useRequestTypes();
  const { data: counts = {} } = useQuery({
    queryKey: ["object-request-counts", objectId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_requests")
        .select("request_type_id, is_new, is_overdue")
        .eq("object_id", objectId)
        .or("is_new.eq.true,is_overdue.eq.true");
      if (error) throw error;
      const m: Record<string, { fresh: number; overdue: number }> = {};
      for (const r of data ?? []) {
        const k = r.request_type_id as string;
        const c = (m[k] ??= { fresh: 0, overdue: 0 });
        if (r.is_new) c.fresh++;
        if (r.is_overdue) c.overdue++;
      }
      return m;
    },
  });

  return (
    <nav className="flex flex-wrap gap-2 xl:flex-col xl:flex-nowrap" aria-label="Виды заявок">
      <div className="hidden pb-1 text-base font-semibold text-muted-foreground xl:block">Заявки</div>
      {types
        .filter((t) => t.is_active)
        .map((t) => {
          const c = counts[t.id];
          const active = activeType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={`flex min-h-12 items-center gap-2 rounded-lg border-2 px-4 py-2 text-left text-lg font-medium transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
              }`}
            >
              <span className="flex-1">{t.name}</span>
              {c && c.fresh > 0 && (
                <span title="Новые" className="rounded-full bg-red-600 px-2 text-base font-bold text-white">
                  {c.fresh}
                </span>
              )}
              {c && c.overdue > 0 && (
                <span title="Просроченные" className="rounded-full bg-red-900 px-2 text-base font-bold text-white">
                  !{c.overdue}
                </span>
              )}
            </button>
          );
        })}
    </nav>
  );
}

function MembersList({ objectId }: { objectId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["object-members-full", objectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("object_members")
        .select("profile_id, profile:profiles!object_members_profile_id_fkey(full_name, phone, email, role:roles!profiles_role_code_fkey(name, sort))")
        .eq("object_id", objectId);
      if (error) throw error;
      type Row = {
        profile_id: string;
        profile: { full_name: string; phone: string | null; email: string | null; role: { name: string; sort: number } | null } | null;
      };
      return ((data ?? []) as unknown as Row[]).sort(
        (a, b) => (a.profile?.role?.sort ?? 99) - (b.profile?.role?.sort ?? 99) || (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "", "ru"),
      );
    },
  });
  if (isLoading) return null;
  if (data.length === 0) return <p className="py-6 text-lg text-muted-foreground">Участники не назначены</p>;
  return (
    <div className="divide-y rounded-lg border">
      {data.map((m) => (
        <div key={m.profile_id} className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-lg">
          <span className="w-48 text-muted-foreground">{m.profile?.role?.name}</span>
          <span className="flex-1 font-medium">{m.profile?.full_name}</span>
          {m.profile?.phone && <span>{m.profile.phone}</span>}
          {m.profile?.email && <span className="text-muted-foreground">{m.profile.email}</span>}
        </div>
      ))}
    </div>
  );
}
