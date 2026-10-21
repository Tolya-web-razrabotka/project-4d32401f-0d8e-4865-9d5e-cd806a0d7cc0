import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, Plus, Printer, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { mskToday } from "@/lib/dates";
import { exportXlsx, printTable, type Column } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toolbar } from "@/components/directories/common";
import { useRequestTypes } from "@/components/directories/request-types/data";
import { useObjects } from "@/components/objects/data";
import {
  REQUEST_STATUSES,
  RequestStatusBadge,
  formatValue,
  overdueDays,
  statusInfo,
  useFieldValues,
  useRequests,
  type FieldValue,
  type RequestRow,
} from "./data";

const ALL = "__all";

type Filters = {
  object: string;
  type: string;
  status: string;
  from: string;
  to: string;
  onlyOpen: boolean;
  onlyOverdue: boolean;
};

/** Ключевые поля для колонки: первые 3 непустых, кроме файлов. */
function keyFields(values: FieldValue[]) {
  return values
    .filter((v) => v.field_type !== "file" && formatValue(v.field_type, v.value) !== "")
    .slice(0, 3)
    .map((v) => `${v.label}: ${formatValue(v.field_type, v.value)}`);
}

export function RequestsList({
  objectId,
  typeId,
  onClearType,
}: {
  /** Если задан — список одного объекта (колонка и фильтр «Объект» скрыты). */
  objectId?: string;
  /** Вид, выбранный кнопкой на странице объекта. */
  typeId?: string | undefined;
  onClearType?: () => void;
}) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useRequests(objectId);
  const { data: types = [] } = useRequestTypes();
  const { data: objects = [] } = useObjects();
  const ids = rows.map((r) => r.id);
  const { data: values = [] } = useFieldValues(ids, objectId ?? "all");

  const [search, setSearch] = useState("");
  const [f, setF] = useState<Filters>({ object: ALL, type: ALL, status: ALL, from: "", to: "", onlyOpen: false, onlyOverdue: false });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));
  const effectiveType = typeId ?? (f.type === ALL ? undefined : f.type);

  const valuesByRequest = useMemo(() => {
    const m: Record<string, FieldValue[]> = {};
    for (const v of values) (m[v.request_id] ??= []).push(v);
    return m;
  }, [values]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^№/, "");
    return rows.filter((r) => {
      if (f.object !== ALL && r.object_id !== f.object) return false;
      if (effectiveType && r.request_type_id !== effectiveType) return false;
      if (f.status !== ALL && r.status !== f.status) return false;
      if (f.from && r.call_date < f.from) return false;
      if (f.to && r.call_date > f.to) return false;
      if (f.onlyOpen && r.status === "done") return false;
      if (f.onlyOverdue && !r.is_overdue) return false;
      if (q) {
        const hay = [
          String(r.number),
          r.type_name,
          r.object_name,
          r.representative_name,
          r.result_text,
          ...(valuesByRequest[r.id] ?? []).map((v) => formatValue(v.field_type, v.value)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, f, effectiveType, search, valuesByRequest]);

  const typeName = types.find((t) => t.id === typeId)?.name;
  const showObject = !objectId;
  const newLink = () =>
    navigate({
      to: "/requests/new",
      search: { ...(objectId ? { object: objectId } : {}), ...(effectiveType ? { type: effectiveType } : {}) },
    });

  const columns: Column<RequestRow>[] = [
    { header: "№", value: (r) => r.number, width: 7 },
    { header: "Дата формирования", value: (r) => formatDate(r.created_at), width: 12 },
    { header: "Дата вызова", value: (r) => formatDate(r.call_date), width: 12 },
    { header: "Вид", value: (r) => r.type_name, width: 18 },
    ...(showObject ? [{ header: "Объект", value: (r: RequestRow) => r.object_name, width: 35 }] : []),
    { header: "Кого вызываем", value: (r) => r.representative_name, width: 18 },
    { header: "Поля", value: (r) => keyFields(valuesByRequest[r.id] ?? []).join("; "), width: 40 },
    { header: "Статус", value: (r) => statusInfo(r.status).label + (r.is_overdue ? ` (не исполнена ${overdueDays(r)} дн.)` : ""), width: 22 },
    { header: "Результат", value: (r) => r.result_text, width: 20 },
    { header: "Инициатор", value: (r) => r.initiator_name, width: 20 },
    { header: "Офис-менеджер", value: (r) => r.office_name, width: 20 },
  ];

  return (
    <div>
      {typeName && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-accent px-4 py-2 text-sm">
          <span>
            Вид: <span className="font-semibold">{typeName}</span>
          </span>
          {onClearType && (
            <Button variant="ghost" size="sm" onClick={onClearType} className="text-sm">
              <X className="size-3.5" /> Все виды
            </Button>
          )}
        </div>
      )}

      <Toolbar search={search} onSearch={setSearch}>
        <Button onClick={newLink} className="h-9 px-4 text-sm">
          <Plus className="size-4" /> Новая заявка
        </Button>
      </Toolbar>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {showObject && (
          <Select value={f.object} onValueChange={(v) => set("object", v)}>
            <SelectTrigger className="h-9 w-64 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-sm">Все объекты</SelectItem>
              {objects.map((o) => (
                <SelectItem key={o.id} value={o.id} className="text-sm">{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!typeId && (
          <Select value={f.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger className="h-9 w-52 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-sm">Все виды</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={f.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="h-9 w-52 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-sm">Все статусы</SelectItem>
            {REQUEST_STATUSES.map((s) => (
              <SelectItem key={s.v} value={s.v} className="text-sm">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          Вызов с
          <Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} className="h-9 w-40 text-sm" />
          по
          <Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} className="h-9 w-40 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.onlyOpen} onCheckedChange={(v) => set("onlyOpen", v)} /> Только незакрытые
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.onlyOverdue} onCheckedChange={(v) => set("onlyOverdue", v)} /> Только просроченные
        </label>
        <Button
          variant="outline"
          className="ml-auto h-9 text-sm"
          disabled={visible.length === 0}
          onClick={() => exportXlsx(`Заявки — ${formatDate(mskToday())}`, "Заявки", columns, visible)}
        >
          <FileSpreadsheet className="size-4" /> Выгрузить в Excel
        </Button>
        <Button
          variant="outline"
          className="h-9 text-sm"
          disabled={visible.length === 0}
          onClick={() =>
            printTable(
              typeName ? `Заявки — ${typeName}` : "Заявки",
              `На ${formatDate(mskToday())} · заявок: ${visible.length}`,
              columns,
              visible,
            )
          }
        >
          <Printer className="size-4" /> Печать
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-semibold">№</th>
              <th className="px-3 py-2 font-semibold">Сформирована</th>
              <th className="px-3 py-2 font-semibold">Вызов на</th>
              <th className="px-3 py-2 font-semibold">Вид</th>
              {showObject && <th className="px-3 py-2 font-semibold">Объект</th>}
              <th className="px-3 py-2 font-semibold">Данные</th>
              <th className="px-3 py-2 font-semibold">Статус</th>
              <th className="px-3 py-2 font-semibold">Инициатор</th>
              <th className="px-3 py-2 font-semibold">Офис-менеджер</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? null : visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "Заявок пока нет" : "Ничего не найдено"}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const tone = r.is_overdue
                  ? "bg-red-50 dark:bg-red-950/40"
                  : r.status === "done"
                    ? "bg-green-50/60 dark:bg-green-950/20"
                    : "";
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate({ to: "/requests/$requestId", params: { requestId: r.id } })}
                    className={`cursor-pointer border-t align-top hover:bg-muted/40 ${tone}`}
                  >
                    <td className="px-3 py-2 font-semibold">
                      {r.number}
                      {r.is_new && (
                        <span className="ml-2 inline-block rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">Новая</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(r.created_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {formatDate(r.call_date)}
                      {r.is_overdue && (
                        <div className="text-xs font-semibold text-red-700 dark:text-red-300">не исполнена {overdueDays(r)} дн.</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.type_name}
                      {r.representative_name && <div className="text-xs text-muted-foreground">{r.representative_name}</div>}
                    </td>
                    {showObject && <td className="px-3 py-2">{r.object_name}</td>}
                    <td className="px-3 py-2 text-xs">
                      {keyFields(valuesByRequest[r.id] ?? []).map((t) => (
                        <div key={t}>{t}</div>
                      ))}
                      {r.result_text && <div className="font-semibold">Результат: {r.result_text}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <RequestStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2">{r.initiator_name}</td>
                    <td className="px-3 py-2">{r.office_name}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
