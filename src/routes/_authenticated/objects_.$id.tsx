import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { tabsListClass, tabTriggerClass } from "@/lib/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObject } from "@/components/objects/data";
import { ObjectHeader } from "@/components/objects/ObjectHeader";
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


function ObjectPage() {
  const { id } = Route.useParams();
  const { tab = "stages", type } = Route.useSearch();
  const navigate = useNavigate({ from: "/objects/$id" });
  const { is_admin } = useProfile();
  const { data: o, isLoading } = useObject(id);

  const go = (next: { tab: Tab; type?: string | undefined }) =>
    navigate({ search: { tab: next.tab, ...(next.type ? { type: next.type } : {}) }, replace: true });

  const back = (
    <Link to="/objects" className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
      <ArrowLeft className="size-4" /> К объектам
    </Link>
  );

  if (isLoading) return <div className="text-base text-muted-foreground">Загрузка…</div>;
  if (!o) {
    return (
      <div>
        {back}
        <p className="py-10 text-base text-muted-foreground">Объект не найден или у вас нет к нему доступа</p>
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
            <Button asChild variant="outline" className="h-9 text-sm">
              <Link to="/objects/$id/edit" params={{ id }}>
                <Pencil className="size-4" /> Редактировать
              </Link>
            </Button>
          )
        }
      />

      <div>
        {/* Кнопки видов заявок слева убраны по правке 2.9 — вид выбирается фильтром на вкладке «Заявки» */}
        <Tabs value={tab} onValueChange={(v) => go({ tab: v as Tab })} className="min-w-0">
          <TabsList className={tabsListClass}>
            <TabsTrigger value="stages" className={tabTriggerClass}>Этапы</TabsTrigger>
            <TabsTrigger value="requests" className={tabTriggerClass}>Заявки</TabsTrigger>
            <TabsTrigger value="members" className={tabTriggerClass}>Участники</TabsTrigger>
            <TabsTrigger value="history" className={tabTriggerClass}>История</TabsTrigger>
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
  if (data.length === 0) return <p className="py-4 text-sm text-muted-foreground">Участники не назначены</p>;
  return (
    <div className="divide-y rounded-md border bg-card">
      {data.map((m) => (
        <div key={m.profile_id} className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm">
          <span className="w-48 text-muted-foreground">{m.profile?.role?.name}</span>
          <span className="flex-1 font-medium">{m.profile?.full_name}</span>
          {m.profile?.phone && <span>{m.profile.phone}</span>}
          {m.profile?.email && <span className="text-muted-foreground">{m.profile.email}</span>}
        </div>
      ))}
    </div>
  );
}
