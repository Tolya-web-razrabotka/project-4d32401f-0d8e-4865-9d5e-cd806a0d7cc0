import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, Toolbar, matches } from "@/components/directories/common";
import {
  OBJECT_STATUSES,
  OBJECT_TYPES,
  TONE_CLASS,
  contractTone,
  daysLeftText,
  statusLabel,
  typeLabel,
  useObjects,
  type ObjectRow,
} from "@/components/objects/data";

export const Route = createFileRoute("/_authenticated/objects")({
  component: ObjectsPage,
  head: () => ({
    meta: [
      { title: "Объекты — Лидер" },
      { name: "description", content: "Объекты в системе «Лидер»" },
    ],
  }),
});

type Problem =
  | "stages_overdue"
  | "stages_no_response"
  | "stages_on_review"
  | "stages_no_executor"
  | "requests_new"
  | "requests_overdue";

/** Сводка сверху (ТЗ 7.2). bad — красная плитка, warn — оранжевая/жёлтая. */
const PROBLEMS: { key: Problem; label: string; tone: "bad" | "warn" | "info" }[] = [
  { key: "stages_overdue", label: "Просрочено этапов", tone: "bad" },
  { key: "stages_no_response", label: "Нет ответа в срок", tone: "bad" },
  { key: "stages_on_review", label: "Ждут проверки", tone: "info" },
  { key: "stages_no_executor", label: "Без исполнителя", tone: "warn" },
  { key: "requests_new", label: "Новые заявки", tone: "bad" },
  { key: "requests_overdue", label: "Просроченные заявки", tone: "bad" },
];

const TILE_TONE = {
  bad: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100",
  warn: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100",
  info: "border-pink-300 bg-pink-50 text-pink-900 dark:border-pink-800 dark:bg-pink-950/50 dark:text-pink-100",
};

function ObjectsPage() {
  const { is_admin } = useProfile();
  const navigate = useNavigate();
  const { data: objects = [], isLoading } = useObjects();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [archive, setArchive] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const scope = useMemo(
    () => objects.filter((o) => (archive ? o.status === "completed" : o.status !== "completed")),
    [objects, archive],
  );
  const totals = useMemo(() => {
    const t = {} as Record<Problem, number>;
    for (const p of PROBLEMS) t[p.key] = scope.reduce((s, o) => s + o[p.key], 0);
    return t;
  }, [scope]);

  const rows = scope.filter(
    (o) =>
      matches(search, o.name, o.address) &&
      (status === "all" || o.status === status) &&
      (type === "all" || o.object_type === type) &&
      (!problem || o[problem] > 0),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="flex-1 text-3xl font-bold">{archive ? "Архив объектов" : "Объекты"}</h1>
        {is_admin && (
          <Button onClick={() => navigate({ to: "/objects/new" })} className="h-12 px-6 text-lg">
            <Plus className="size-5" /> Создать объект
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {PROBLEMS.map((p) => {
          const n = totals[p.key] ?? 0;
          const active = problem === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setProblem(active ? null : p.key)}
              className={`rounded-xl border-2 p-4 text-left transition-shadow ${
                n > 0 ? TILE_TONE[p.tone] : "border-border bg-card text-muted-foreground"
              } ${active ? "ring-4 ring-primary/40" : "hover:shadow-md"}`}
            >
              <div className="text-4xl font-bold leading-none">{n}</div>
              <div className="mt-2 text-base font-medium leading-tight">{p.label}</div>
            </button>
          );
        })}
      </div>

      <Toolbar search={search} onSearch={setSearch}>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-12 w-52 text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">Все статусы</SelectItem>
            {OBJECT_STATUSES.filter((s) => (archive ? s.v === "completed" : s.v !== "completed")).map((s) => (
              <SelectItem key={s.v} value={s.v} className="text-base">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-12 w-40 text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">Все типы</SelectItem>
            {OBJECT_TYPES.map((t) => (
              <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-3 text-lg">
          <Switch
            checked={archive}
            onCheckedChange={(v) => {
              setArchive(v);
              setStatus("all");
              setProblem(null);
            }}
          />
          Архив
        </label>
      </Toolbar>

      {problem && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-accent px-4 py-3 text-lg">
          Показаны объекты: «{PROBLEMS.find((p) => p.key === problem)?.label}»
          <Button variant="ghost" size="sm" onClick={() => setProblem(null)} className="ml-auto text-base">
            <X className="size-4" /> Сбросить
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-base">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Наименование</TableHead>
              <TableHead className="min-w-40">Адрес</TableHead>
              <TableHead>Заказчик</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead className="min-w-48">Текущий этап</TableHead>
              <TableHead>Готовность</TableHead>
              <TableHead className="min-w-44">Срок по договору</TableHead>
              <TableHead>Проблемы</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? null : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-lg text-muted-foreground">
                  {objects.length === 0
                    ? is_admin
                      ? "Объектов пока нет. Нажмите «Создать объект»."
                      : "Вы пока не участник ни одного объекта"
                    : "Ничего не найдено"}
                </td>
              </tr>
            ) : (
              rows.map((o) => <ObjectTableRow key={o.id} o={o} onOpen={() => navigate({ to: "/objects/$id", params: { id: o.id } })} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ObjectTableRow({ o, onOpen }: { o: ObjectRow; onOpen: () => void }) {
  const tone = o.status === "completed" ? "none" : contractTone(o.contract_days_left);
  const chips: { n: number; text: string; cls: string }[] = [
    { n: o.stages_overdue, text: "просрочено", cls: "bg-red-600 text-white" },
    { n: o.stages_no_response, text: "нет ответа", cls: "border border-red-600 text-red-700 dark:text-red-300" },
    { n: o.stages_on_review, text: "на проверке", cls: "bg-pink-600 text-white" },
    { n: o.stages_no_executor, text: "без исполн.", cls: "bg-orange-500 text-white" },
    { n: o.requests_new, text: "новых заявок", cls: "bg-red-600 text-white" },
    { n: o.requests_overdue, text: "заявок просроч.", cls: "bg-red-800 text-white" },
  ].filter((c) => c.n > 0);

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell>
        <div className="font-semibold">{o.name}</div>
        {o.status !== "in_work" && <div className="text-sm text-muted-foreground">{statusLabel(o.status)}</div>}
      </TableCell>
      <TableCell className="text-muted-foreground">{o.address}</TableCell>
      <TableCell>{o.customer_name}</TableCell>
      <TableCell>{typeLabel(o.object_type)}</TableCell>
      <TableCell>{o.responsible_name}</TableCell>
      <TableCell>
        {o.current_stage_number !== null && o.current_stage_number !== undefined ? (
          <span>
            <span className="font-semibold">{o.current_stage_number}.</span> {o.current_stage_name}
          </span>
        ) : o.stages_total > 0 ? (
          <span className="text-green-700 dark:text-green-400">Все этапы закрыты</span>
        ) : (
          <span className="text-muted-foreground">Этапов нет</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-28 items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-green-600" style={{ width: `${o.progress_pct}%` }} />
          </div>
          <span className="w-11 text-right font-semibold">{o.progress_pct}%</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {o.stages_closed} из {o.stages_total}
        </div>
      </TableCell>
      <TableCell>
        <div className="whitespace-nowrap">
          {formatDate(o.contract_start)} — {formatDate(o.contract_end)}
        </div>
        {o.status !== "completed" && o.contract_days_left !== null && (
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-sm font-medium ${TONE_CLASS[tone]}`}>
            {daysLeftText(o.contract_days_left)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex max-w-56 flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.text} className={`whitespace-nowrap rounded px-2 py-0.5 text-sm font-semibold ${c.cls}`}>
              {c.n} {c.text}
            </span>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
