import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, emptyToNull } from "../common";
import { STAGES_KEY, toIntOrNull, useRoles, useWorkTypes, type StageTemplate } from "./data";

const NONE = "__none";

export function StageMainForm({
  stage,
  allStages,
  readOnly,
  onCreated,
}: {
  stage: StageTemplate | null;
  allStages: StageTemplate[];
  readOnly: boolean;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: roles = [] } = useRoles();
  const { data: workTypes = [] } = useWorkTypes();

  const nextNumber = allStages.reduce((m, s) => Math.max(m, s.number), 0) + 1;
  const [number, setNumber] = useState(String(stage?.number ?? nextNumber));
  const [name, setName] = useState(stage?.name ?? "");
  const [workType, setWorkType] = useState(stage?.work_type_id ?? "");
  const [description, setDescription] = useState(stage?.description ?? "");
  const [duration, setDuration] = useState(stage?.duration_days?.toString() ?? "");
  const [executor, setExecutor] = useState(stage?.executor_role ?? NONE);
  const [confirmer, setConfirmer] = useState(stage?.confirmer_role ?? NONE);
  const [outgoing, setOutgoing] = useState(stage?.outgoing_doc ?? "");
  const [expected, setExpected] = useState(stage?.expected_doc ?? "");
  const [responseDays, setResponseDays] = useState(stage?.response_days?.toString() ?? "");
  const [remindDays, setRemindDays] = useState(stage?.remind_days?.toString() ?? "");
  const [critical, setCritical] = useState(stage?.is_critical ?? false);
  const [active, setActive] = useState(stage?.is_active ?? true);

  const m = useMutation({
    mutationFn: async () => {
      const num = toIntOrNull(number);
      const dur = toIntOrNull(duration);
      const resp = toIntOrNull(responseDays);
      const rem = toIntOrNull(remindDays);
      if (num === null || num === "bad" || num < 1) throw new Error("Номер этапа — целое число больше 0");
      if (dur === "bad" || resp === "bad" || rem === "bad")
        throw new Error("Сроки — целые числа от 0 или пусто");
      if (!name.trim()) throw new Error("Укажите название этапа");
      if (!workType) throw new Error("Выберите вид работ");
      if (allStages.some((s) => s.number === num && s.id !== stage?.id))
        throw new Error(`Этап с номером ${num} уже есть`);

      const payload = {
        number: num,
        sort: num,
        name: name.trim(),
        work_type_id: workType,
        description: emptyToNull(description),
        duration_days: dur,
        executor_role: executor === NONE ? null : executor,
        confirmer_role: confirmer === NONE ? null : confirmer,
        outgoing_doc: emptyToNull(outgoing),
        expected_doc: emptyToNull(expected),
        response_days: resp,
        remind_days: rem,
        is_critical: critical,
        is_active: active,
      };
      if (stage) {
        const { error } = await supabase.from("stage_templates").update(payload).eq("id", stage.id);
        if (error) throw error;
        return stage.id;
      }
      const { data, error } = await supabase.from("stage_templates").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["dir-stage-templates-short"] });
      await qc.invalidateQueries({ queryKey: STAGES_KEY });
      if (!stage) onCreated(id);
    },
    onError: showError,
  });

  const roleSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange} disabled={readOnly}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className="text-sm">Не указано</SelectItem>
        {roles.map((r) => (
          <SelectItem key={r.code} value={r.code} className="text-sm">{r.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const num = (value: string, onChange: (v: string) => void) => (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      disabled={readOnly}
      className="h-9 text-sm"
    />
  );

  return (
    <form
      className="max-w-3xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
        <Field label="Номер" required>{num(number, setNumber)}</Field>
        <Field label="Название" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} className="h-9 text-sm" />
        </Field>
      </div>
      <Field label="Вид работ" required>
        <Select value={workType} onValueChange={setWorkType} disabled={readOnly}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите вид работ" /></SelectTrigger>
          <SelectContent>
            {workTypes.map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-sm">{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && <p className="text-xs text-muted-foreground">Список настраивается в Справочниках, вкладка «Виды работ».</p>}
      </Field>
      <Field label="Описание">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} className="text-sm" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Роль исполнителя">{roleSelect(executor, setExecutor)}</Field>
        <Field label="Адресат — кто подтверждает">{roleSelect(confirmer, setConfirmer)}</Field>
        <Field label="«От нас» — исходящий документ">
          <Input value={outgoing} onChange={(e) => setOutgoing(e.target.value)} disabled={readOnly} className="h-9 text-sm" />
        </Field>
        <Field label="«Ждём» — ответный документ">
          <Input value={expected} onChange={(e) => setExpected(e.target.value)} disabled={readOnly} className="h-9 text-sm" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Срок этапа, дней">{num(duration, setDuration)}</Field>
        <Field label="Дней на ответ">{num(responseDays, setResponseDays)}</Field>
        <Field label="Напомнить за, дней">{num(remindDays, setRemindDays)}</Field>
      </div>
      <div className="flex flex-wrap gap-8">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={critical} onCheckedChange={setCritical} disabled={readOnly} /> Критичный
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={active} onCheckedChange={setActive} disabled={readOnly} /> Активен
        </label>
      </div>
      {!active && (
        <p className="text-sm text-muted-foreground">
          Неактивный этап не предлагается при создании новых объектов. На уже созданных объектах он остаётся.
        </p>
      )}
      {!readOnly && (
        <Button type="submit" disabled={m.isPending} className="h-9 px-5 text-sm">
          {m.isPending ? "Сохранение…" : "Сохранить"}
        </Button>
      )}
    </form>
  );
}
