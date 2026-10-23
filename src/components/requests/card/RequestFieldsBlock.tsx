import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/directories/common";
import type { RequestField } from "@/components/directories/request-types/data";
import { FieldInput } from "../FieldInput";
import { formatValue, type FieldValue } from "../data";

/**
 * Поля заявки одной группы (прораб или офис-менеджер). Значения сохраняются через
 * request_save_values() — со снимком подписи. Значения удалённых/отключённых полей
 * показываются по сохранённой подписи только для чтения.
 */
export function RequestFieldsBlock({
  title,
  hint,
  requestId,
  fields,
  values,
  orphanValues,
  readOnly,
  onSaved,
}: {
  title: string;
  hint?: string;
  requestId: string;
  fields: RequestField[];
  values: FieldValue[];
  orphanValues: FieldValue[];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const initial = Object.fromEntries(values.map((v) => [v.field_id, v.value]));
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const editable = fields.filter((f) => f.field_type !== "file");
  const dirty = editable.some((f) => JSON.stringify(draft[f.id] ?? null) !== JSON.stringify(initial[f.id] ?? null));

  const save = useMutation({
    mutationFn: async () => {
      const p_values = editable
        .filter((f) => JSON.stringify(draft[f.id] ?? null) !== JSON.stringify(initial[f.id] ?? null))
        .map((f) => ({ field_id: f.id, value: draft[f.id] ?? null }));
      const { error } = await supabase.rpc("request_save_values", { p_request_id: requestId, p_values: p_values as never });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      onSaved();
    },
    onError: showError,
  });

  if (editable.length === 0 && orphanValues.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {editable.map((f) => (
          // Подпись — из снимка в заявке, если значение уже сохранено: переименование поля в справочнике её не меняет
          // Многострочные поля и пикеты — на всю ширину карточки
          <div key={f.id} className={f.field_type === "textarea" || f.field_type === "picket_range" ? "sm:col-span-2" : ""}>
            <Field label={values.find((v) => v.field_id === f.id)?.label ?? f.label} required={f.is_required}>
              <FieldInput
                field={f}
                value={draft[f.id]}
                disabled={readOnly}
                onChange={(v) => setDraft((x) => ({ ...x, [f.id]: v }))}
              />
            </Field>
          </div>
        ))}
        {orphanValues.map((v) => (
          <div key={v.field_id} className="space-y-2">
            <div className="text-sm text-muted-foreground">{v.label}</div>
            <div className="flex min-h-9 items-center whitespace-pre-line rounded-md border bg-muted px-3 py-2 text-sm">{formatValue(v.field_type, v.value)}</div>
          </div>
        ))}
      </div>
      {!readOnly && editable.length > 0 && (
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="mt-5 h-9 px-4 text-sm">
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </Button>
      )}
    </section>
  );
}
