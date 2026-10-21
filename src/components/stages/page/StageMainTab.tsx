import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, showError } from "@/lib/format";
import { addDays } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/directories/common";
import { toIntOrNull } from "@/components/directories/stages/data";
import { useActiveProfiles } from "@/components/objects/data";
import { StatusBadge, useObjectStages, type ObjectStage } from "../data";

const NONE = "__none";

export function StageMainTab({ stage, onSaved }: { stage: ObjectStage; onSaved: () => void }) {
  const { data: profiles = [] } = useActiveProfiles();
  const [v, setV] = useState({
    executor_id: stage.executor_id ?? "",
    coexecutor_id: stage.coexecutor_id ?? "",
    confirmer_id: stage.confirmer_id ?? "",
    start_date: stage.start_date ?? "",
    due_date: stage.due_date ?? "",
    doc_sent_at: stage.doc_sent_at ?? "",
    response_days: stage.response_days?.toString() ?? "",
    response_received_at: stage.response_received_at ?? "",
    remind_days: stage.remind_days?.toString() ?? "",
    note: stage.note ?? "",
  });
  const set = (k: keyof typeof v, val: string) => setV((x) => ({ ...x, [k]: val }));

  const respDays = toIntOrNull(v.response_days);
  const responseDue = v.doc_sent_at && typeof respDays === "number" ? addDays(v.doc_sent_at, respDays) : "";

  const save = useMutation({
    mutationFn: async () => {
      const rd = toIntOrNull(v.response_days);
      const rm = toIntOrNull(v.remind_days);
      if (rd === "bad" || rm === "bad") throw new Error("Дни — целое число от 0 или пусто");
      if (v.start_date && v.due_date && v.due_date < v.start_date) throw new Error("Срок окончания раньше даты начала");
      const d = (x: string) => x || null;
      const { error } = await supabase
        .from("object_stages")
        .update({
          executor_id: d(v.executor_id),
          coexecutor_id: d(v.coexecutor_id),
          confirmer_id: d(v.confirmer_id),
          start_date: d(v.start_date),
          due_date: d(v.due_date),
          doc_sent_at: d(v.doc_sent_at),
          response_days: rd,
          response_received_at: d(v.response_received_at),
          remind_days: rm,
          note: v.note.trim() || null,
        })
        .eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      onSaved();
    },
    onError: showError,
  });

  const person = (k: "executor_id" | "coexecutor_id" | "confirmer_id", placeholder: string) => (
    <Select value={v[k] || NONE} onValueChange={(x) => set(k, x === NONE ? "" : x)}>
      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className="text-sm">{placeholder}</SelectItem>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-sm">{p.full_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const date = (k: keyof typeof v) => (
    <Input type="date" value={v[k]} onChange={(e) => set(k, e.target.value)} className="h-9 text-sm" />
  );

  return (
    <div className="max-w-4xl space-y-6">
      {stage.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{stage.description}</p>}
      {stage.return_reason && stage.status_code !== "closed" && (
        <div className="rounded-md border border-orange-400 bg-orange-50 p-4 text-sm dark:bg-orange-950/40">
          <span className="font-semibold">Возвращён на доработку:</span> {stage.return_reason}
        </div>
      )}

      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Исполнитель">{person("executor_id", "не назначен")}</Field>
        <Field label="Соисполнитель">{person("coexecutor_id", "— нет —")}</Field>
        <Field label={`Адресат${stage.confirmer_role_name ? ` (по регламенту: ${stage.confirmer_role_name})` : ""}`}>
          {person("confirmer_id", "— по роли —")}
        </Field>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Дата начала">{date("start_date")}</Field>
        <Field label="Срок окончания">{date("due_date")}</Field>
        <Field label="Напомнить за, дней">
          <Input value={v.remind_days} onChange={(e) => set("remind_days", e.target.value)} inputMode="numeric" className="h-9 text-sm" />
        </Field>
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="mb-4 text-sm font-semibold">
          Документ{stage.outgoing_doc ? ` «${stage.outgoing_doc}»` : ""}
          {stage.expected_doc ? ` → ждём «${stage.expected_doc}»` : ""}
        </div>
        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Отправлен">{date("doc_sent_at")}</Field>
          <Field label="Дней на ответ">
            <Input value={v.response_days} onChange={(e) => set("response_days", e.target.value)} inputMode="numeric" className="h-9 text-sm" />
          </Field>
          <Field label="Ответ ждём до">
            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">{formatDate(responseDue) || "—"}</div>
          </Field>
          <Field label="Ответ получен">{date("response_received_at")}</Field>
        </div>
      </section>

      <Field label="Примечание — что мешает, когда обещали">
        <Textarea value={v.note} onChange={(e) => set("note", e.target.value)} rows={3} className="text-sm" />
      </Field>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="h-9 px-5 text-sm">
        {save.isPending ? "Сохранение…" : "Сохранить"}
      </Button>

      <Predecessors stage={stage} />
      <LinkedRequests stage={stage} />
    </div>
  );
}

function Predecessors({ stage }: { stage: ObjectStage }) {
  const { data: all = [] } = useObjectStages(stage.object_id);
  const { data: ids = [] } = useQuery({
    queryKey: ["stage-predecessors", stage.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("object_stage_predecessors")
        .select("predecessor_id")
        .eq("stage_id", stage.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.predecessor_id as string);
    },
  });
  const preds = all.filter((s) => ids.includes(s.id));
  if (preds.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">Предшествующие этапы</h3>
      <div className="divide-y rounded-md border bg-card">
        {preds.map((p) => (
          <Link
            key={p.id}
            to="/objects/$id/stages/$stageId"
            params={{ id: stage.object_id, stageId: p.id }}
            className="flex items-center gap-4 px-4 py-2 text-sm hover:bg-muted/50"
          >
            <span className="w-8 font-semibold">{p.number}</span>
            <span className="flex-1">{p.name}</span>
            <StatusBadge name={p.status_name} color={p.status_color} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LinkedRequests({ stage }: { stage: ObjectStage }) {
  const { data = [] } = useQuery({
    queryKey: ["stage-requests", stage.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_requests")
        .select("id, number, type_name, call_date, status")
        .eq("stage_id", stage.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (data.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">Связанные заявки</h3>
      <div className="divide-y rounded-md border bg-card">
        {data.map((r) => (
          <Link
            key={r.id}
            to="/requests/$requestId"
            params={{ requestId: r.id! }}
            className="flex flex-wrap items-center gap-4 px-4 py-2 text-sm hover:bg-muted/50"
          >
            <span className="font-semibold">№{r.number}</span>
            <span className="flex-1">{r.type_name}</span>
            <span className="text-muted-foreground">вызов на {formatDate(r.call_date)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
