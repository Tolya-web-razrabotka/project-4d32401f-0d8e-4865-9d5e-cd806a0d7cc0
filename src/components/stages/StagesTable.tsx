import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, showError } from "@/lib/format";
import { daysBetween, mskToday } from "@/lib/dates";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConditionToggle } from "./ConditionToggle";
import {
  StatusBadge,
  useObjectConditions,
  useObjectPredecessors,
  useObjectStages,
  useRefreshStages,
  type ObjectStage,
  type StageCondition,
} from "./data";

const ALL = "__all";
const NOBODY = "__nobody";

export type StagesTableFilters = {
  workType: string;
  executor: string;
  onlyOverdue: boolean;
  onlyOpen: boolean;
  showExcluded: boolean;
};

/** Видимые строки таблицы с учётом фильтров — их же выгружаем в Excel и печатаем. */
export function filterStages(stages: ObjectStage[], f: StagesTableFilters) {
  return stages.filter(
    (s) =>
      (f.showExcluded || !s.is_excluded) &&
      (f.workType === ALL || (s.work_type_id ?? "") === f.workType) &&
      (f.executor === ALL || (f.executor === NOBODY ? !s.executor_id : s.executor_id === f.executor)) &&
      (!f.onlyOverdue || s.is_overdue || s.is_no_response) &&
      (!f.onlyOpen || !s.is_closed),
  );
}

/** Подсветка строки по разделу 8 ТЗ. */
export function rowTone(s: ObjectStage) {
  if (s.is_excluded) return "bg-muted/60 text-muted-foreground";
  if (s.is_overdue) return "bg-red-50 dark:bg-red-950/40";
  if (s.is_due_soon) return "bg-amber-50 dark:bg-amber-950/30";
  return "";
}

export function StagesTable({
  objectId,
  toolbar,
}: {
  objectId: string;
  /** Дополнительные кнопки панели (Excel, печать) получают видимые строки. */
  toolbar?: (visible: ObjectStage[]) => ReactNode;
}) {
  const { data: stages = [], isLoading } = useObjectStages(objectId);
  const ids = stages.map((s) => s.id);
  const { data: conditions = [] } = useObjectConditions(objectId, ids);
  const { data: preds = {} } = useObjectPredecessors(objectId, ids);
  const refresh = useRefreshStages();

  const [f, setF] = useState<StagesTableFilters>({
    workType: ALL,
    executor: ALL,
    onlyOverdue: false,
    onlyOpen: false,
    showExcluded: false,
  });
  const [closedOpen, setClosedOpen] = useState(false);

  const workTypes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stages) if (s.work_type_id) m.set(s.work_type_id, s.work_type_name ?? "");
    return [...m.entries()];
  }, [stages]);
  const executors = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stages) if (s.executor_id) m.set(s.executor_id, s.executor_name ?? "");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [stages]);

  const condByStage = useMemo(() => {
    const m: Record<string, StageCondition[]> = {};
    for (const c of conditions) (m[c.stage_id] ??= []).push(c);
    return m;
  }, [conditions]);
  const numberById = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.number])), [stages]);

  const visible = filterStages(stages, f);
  const open = visible.filter((s) => !s.is_closed);
  const closed = visible.filter((s) => s.is_closed);

  // Группы по видам работ со счётчиком «закрыто N из M» (по всем не исключённым этапам группы)
  const groups = useMemo(() => {
    const order: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const s of stages) {
      const id = s.work_type_id ?? "";
      if (!seen.has(id)) {
        seen.add(id);
        order.push({ id, name: s.work_type_name ?? "Без вида работ" });
      }
    }
    return order
      .map((g) => {
        const inGroup = stages.filter((s) => (s.work_type_id ?? "") === g.id && !s.is_excluded);
        return {
          ...g,
          total: inGroup.length,
          closed: inGroup.filter((s) => s.is_closed).length,
          rows: open.filter((s) => (s.work_type_id ?? "") === g.id),
        };
      })
      .filter((g) => g.rows.length > 0);
  }, [stages, open]);

  if (isLoading) return <p className="py-4 text-sm text-muted-foreground">Загрузка…</p>;

  const set = <K extends keyof StagesTableFilters>(k: K, v: StagesTableFilters[K]) => setF((x) => ({ ...x, [k]: v }));
  const onChanged = () => refresh(objectId);
  const rowProps = { objectId, condByStage, preds, numberById, onChanged };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={f.workType} onValueChange={(v) => set("workType", v)}>
          <SelectTrigger className="h-9 w-60 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-sm">Все виды работ</SelectItem>
            {workTypes.map(([id, name]) => (
              <SelectItem key={id} value={id} className="text-sm">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.executor} onValueChange={(v) => set("executor", v)}>
          <SelectTrigger className="h-9 w-56 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-sm">Все исполнители</SelectItem>
            <SelectItem value={NOBODY} className="text-sm">Не назначен</SelectItem>
            {executors.map(([id, name]) => (
              <SelectItem key={id} value={id} className="text-sm">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.onlyOverdue} onCheckedChange={(v) => set("onlyOverdue", v)} /> Только просроченные
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.onlyOpen} onCheckedChange={(v) => set("onlyOpen", v)} /> Только незакрытые
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.showExcluded} onCheckedChange={(v) => set("showExcluded", v)} /> Показать исключённые
        </label>
        {toolbar && <div className="ml-auto flex gap-2">{toolbar(visible)}</div>}
      </div>

      {/* По эскизу «Рабочий стол прораба»: таблица прокручивается в своей области, шапка колонок закреплена */}
      <div className="max-h-[70vh] overflow-auto rounded-md border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <StagesHead />
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {stages.length === 0 ? "На объекте нет этапов" : "Нет этапов по выбранным условиям"}
                </td>
              </tr>
            )}
            {groups.map((g) => [
              <tr key={`g-${g.id}`} className="border-t bg-muted/70">
                <td colSpan={8} className="px-3 py-2 text-sm font-semibold">
                  {g.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    закрыто {g.closed} из {g.total}
                  </span>
                </td>
              </tr>,
              ...g.rows.map((s) => <StageRow key={s.id} s={s} {...rowProps} />),
            ])}
          </tbody>
        </table>
      </div>

      {!f.onlyOpen && closed.length > 0 && (
        <div className="mt-6 rounded-md border bg-card">
          <button
            type="button"
            onClick={() => setClosedOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold hover:bg-muted/50"
          >
            {closedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Закрытые (выполненные)
            <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{closed.length}</span>
          </button>
          {closedOpen && (
            <div className="overflow-x-auto border-t">
              <table className="w-full min-w-[1100px] text-sm">
                <StagesHead />
                <tbody>
                  {closed.map((s) => (
                    <StageRow key={s.id} s={s} {...rowProps} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StagesHead() {
  const th = "px-3 py-2 text-left font-semibold text-muted-foreground";
  return (
    <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--color-border)]">
      <tr className="border-b">
        <th className={`${th} w-14`}>N</th>
        <th className={`${th} min-w-64`}>Название этапа</th>
        <th className={`${th} min-w-64`}>Условия закрытия</th>
        <th className={`${th} w-36`}>Дата</th>
        <th className={th}>Статус</th>
        <th className={th}>Исполнитель</th>
        <th className={th}>Адресат</th>
        <th className={`${th} min-w-48`}>Примечание</th>
      </tr>
    </thead>
  );
}

function StageRow({
  s,
  objectId,
  condByStage,
  preds,
  numberById,
  onChanged,
}: {
  s: ObjectStage;
  objectId: string;
  condByStage: Record<string, StageCondition[]>;
  preds: Record<string, string[]>;
  numberById: Record<string, number>;
  onChanged: () => void;
}) {
  const conds = condByStage[s.id] ?? [];
  const predNumbers = (preds[s.id] ?? []).map((id) => numberById[id]).filter((x) => x !== undefined).sort((a, b) => a - b);
  const noResponseDays = s.is_no_response && s.response_due ? daysBetween(s.response_due, mskToday()) : 0;
  const link = { to: "/objects/$id/stages/$stageId" as const, params: { id: objectId, stageId: s.id } };
  const td = "px-3 py-2 align-top";

  return (
    <tr className={`border-t ${rowTone(s)}`}>
      <td className={`${td} ${s.is_no_response ? "border-l-4 border-l-red-600" : ""}`}>
        <Link {...link} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          {s.number}
          {s.is_critical && <Flag className="size-3.5 fill-destructive text-destructive" aria-label="Критичный" />}
        </Link>
      </td>
      <td className={td}>
        <Link {...link} className="font-medium hover:underline">
          {s.name}
        </Link>
        {s.out_of_order && (
          <span
            title={`Взят вне очереди: по регламенту после этапов ${predNumbers.join(", ") || "—"}`}
            className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
          >
            <AlertTriangle className="size-3.5" /> вне очереди
          </span>
        )}
        {(s.outgoing_doc || s.expected_doc) && (
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {s.outgoing_doc && <span>от нас: {s.outgoing_doc}</span>}
            {s.expected_doc && <span>ждём: {s.expected_doc}</span>}
          </div>
        )}
        {s.is_excluded && <div className="mt-1 text-xs">исключён из работы</div>}
      </td>
      <td className={td}>
        {conds.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <div className={`mb-1 text-xs font-semibold ${s.conditions_done === s.conditions_total ? "text-green-700 dark:text-green-400" : ""}`}>
              {s.conditions_done} из {s.conditions_total}
            </div>
            <ul className="space-y-1.5">
              {conds.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs leading-tight">
                  <ConditionToggle cond={c} size="sm" disabled={s.is_excluded} onDone={onChanged} />
                  <span className={c.is_done ? "text-muted-foreground line-through" : ""}>
                    {c.title}
                    {c.kind === "field" && c.value_text && <span className="no-underline"> — {c.value_text}</span>}
                    {!c.is_required && <span className="text-muted-foreground"> (необяз.)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </td>
      <td className={td}>
        <div className={`whitespace-nowrap font-medium ${s.is_overdue ? "text-red-700 dark:text-red-300" : ""}`}>
          {formatDate(s.due_date) || <span className="text-muted-foreground">—</span>}
        </div>
        {s.doc_sent_at && s.response_due && !s.response_received_at && (
          <div className="mt-1 text-xs text-muted-foreground">ответ ждём до {formatDate(s.response_due)}</div>
        )}
        {s.is_no_response && (
          <div className="mt-1 inline-block rounded border border-red-600 px-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
            нет ответа {noResponseDays} дн.
          </div>
        )}
      </td>
      <td className={td}>
        <StatusBadge name={s.status_name} color={s.status_color} />
      </td>
      <td className={td}>
        {s.executor_name ?? (
          <span className={s.is_closed || s.is_excluded ? "text-muted-foreground" : "font-semibold text-orange-600"}>
            не назначен
          </span>
        )}
        {s.coexecutor_name && <div className="text-xs text-muted-foreground">+ {s.coexecutor_name}</div>}
      </td>
      <td className={td}>{s.confirmer_name ?? s.confirmer_role_name ?? <span className="text-muted-foreground">—</span>}</td>
      <td className={td}>
        <NoteCell stage={s} onSaved={onChanged} />
      </td>
    </tr>
  );
}

function NoteCell({ stage, onSaved }: { stage: ObjectStage; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(stage.note ?? "");
  const m = useMutation({
    mutationFn: async () => {
      const note = text.trim() === "" ? null : text.trim();
      const { error } = await supabase.from("object_stages").update({ note }).eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: showError,
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(stage.note ?? "");
          setEditing(true);
        }}
        className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
        title="Нажмите, чтобы изменить"
      >
        {stage.note ? <span className="whitespace-pre-line">{stage.note}</span> : <span className="text-muted-foreground">+ добавить</span>}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} className="text-xs" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Сохранить</Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Отмена</Button>
      </div>
    </div>
  );
}
