import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { tabsListClass, tabTriggerClass } from "@/lib/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ToneBadge";
import { formatDay, useOverdueItems, type OverdueItem } from "@/components/overdue/data";

export const Route = createFileRoute("/_authenticated/overdue")({
  component: OverduePage,
  head: () => ({
    meta: [
      { title: "Просрочено — Лидер" },
      { name: "description", content: "Просроченные заявки и этапы в системе «Лидер»" },
    ],
  }),
});

const ALL = "__all";
type Kind = "all" | "stage" | "request";

/** Раздел «Просрочено» (правка 2.2): то же, что окно при входе, но всегда под рукой. */
function OverduePage() {
  const navigate = useNavigate();
  const { items, isLoading } = useOverdueItems();
  const [kind, setKind] = useState<Kind>("all");
  const [objectId, setObjectId] = useState(ALL);

  const objects = [...new Map(items.map((i) => [i.objectId, i.objectName])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "ru"),
  );
  const rows = items.filter((i) => (kind === "all" || i.kind === kind) && (objectId === ALL || i.objectId === objectId));
  const stagesCount = items.filter((i) => i.kind === "stage").length;
  const requestsCount = items.length - stagesCount;

  const open = (it: OverdueItem) =>
    it.kind === "request"
      ? navigate({ to: "/requests/$requestId", params: { requestId: it.id } })
      : navigate({ to: "/objects/$id/stages/$stageId", params: { id: it.objectId, stageId: it.id } });

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-bold">Просрочено</h1>
        {items.length > 0 && (
          <span className="rounded-full bg-destructive px-2 text-sm font-semibold leading-6 text-destructive-foreground">
            {items.length}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Этапы, у которых прошёл срок, и заявки, не исполненные к дате созвона. Сначала то, что опаздывает дольше всего.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList className={`${tabsListClass} mb-0`}>
            <TabsTrigger value="all" className={tabTriggerClass}>Всё ({items.length})</TabsTrigger>
            <TabsTrigger value="stage" className={tabTriggerClass}>Этапы ({stagesCount})</TabsTrigger>
            <TabsTrigger value="request" className={tabTriggerClass}>Заявки ({requestsCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={objectId} onValueChange={setObjectId}>
          <SelectTrigger className="h-9 w-72 max-w-full text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-sm">Все объекты</SelectItem>
            {objects.map(([id, name]) => (
              <SelectItem key={id} value={id} className="text-sm">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? null : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border bg-card py-12 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-sm font-semibold">Просроченного нет</p>
          <p className="text-sm text-muted-foreground">Все этапы и заявки в срок</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Что</th>
                <th className="px-4 py-2 font-semibold">Объект</th>
                <th className="px-4 py-2 font-semibold">Статус</th>
                <th className="px-4 py-2 font-semibold">Ответственный</th>
                <th className="px-4 py-2 font-semibold">Срок</th>
                <th className="px-4 py-2 font-semibold">Просрочено</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">Ничего не найдено</td>
                </tr>
              ) : (
                rows.map((it) => (
                  <tr
                    key={it.key}
                    onClick={() => open(it)}
                    className="cursor-pointer border-t bg-red-50/60 transition-colors hover:bg-red-100/60 dark:bg-red-950/30"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">{it.title}</div>
                      {it.note && <div className="mt-0.5 text-xs text-muted-foreground">{it.note}</div>}
                    </td>
                    <td className="px-4 py-2">{it.objectName}</td>
                    <td className="px-4 py-2"><ToneBadge color={it.statusColor}>{it.status}</ToneBadge></td>
                    <td className="px-4 py-2">
                      {it.responsible ?? <span className="text-orange-700 dark:text-orange-300">Не назначен</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDay(it.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-bold tabular-nums text-red-700 dark:text-red-300">
                      <AlertTriangle className="mr-1 inline size-3.5 align-[-2px]" />
                      {it.days} дн.
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="outline" className="h-8 text-sm" onClick={(e) => { e.stopPropagation(); open(it); }}>
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
