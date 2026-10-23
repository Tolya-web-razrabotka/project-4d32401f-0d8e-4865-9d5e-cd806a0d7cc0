import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/directories/common";
import type { RequestField } from "@/components/directories/request-types/data";
import { FieldInput, isEmptyValue } from "../FieldInput";
import { formatValue, type FieldValue } from "../data";

/**
 * Поля заявки одной группы (прораб или офис-менеджер). Значения сохраняются через
 * request_save_values() — со снимком подписи. Значения удалённых/отключённых полей
 * показываются по сохранённой подписи только для чтения.
 *
 * Правка 2.13: два режима. Просмотр — значения текстом и кнопка «Изменить»; правка — поля,
 * «Сохранить» и «Отмена». Блок открывается в просмотре, если хоть одно поле уже заполнено.
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
  const hasValues = editable.some((f) => !isEmptyValue(initial[f.id]));
  const [editing, setEditing] = useState(!readOnly && !hasValues);
  const cancel = () => {
    setDraft(initial);
    setEditing(false);
  };

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
      setEditing(false);
      onSaved();
    },
    onError: showError,
  });

  if (editable.length === 0 && orphanValues.length === 0) return null;

  const labelOf = (f: RequestField) => values.find((v) => v.field_id === f.id)?.label ?? f.label;
  const wide = (t: string) => (t === "textarea" || t === "picket_range" ? "sm:col-span-2" : "");
  const mode = editing && !readOnly;

  return (
    <section className={`rounded-lg border bg-card p-4 ${mode ? "ring-2 ring-primary/25" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {title}
            {mode && (
              <span className="ml-3 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-medium text-primary">Редактирование</span>
            )}
          </h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {!readOnly && editable.length > 0 && !mode && (
          <Button variant="outline" onClick={() => setEditing(true)} className="h-9 text-sm">
            <Pencil className="size-3.5" /> Изменить
          </Button>
        )}
      </div>

      {mode ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {editable.map((f) => (
            // Подпись — из снимка в заявке, если значение уже сохранено: переименование поля в справочнике её не меняет
            <div key={f.id} className={wide(f.field_type)}>
              <Field label={labelOf(f)} required={f.is_required}>
                <FieldInput field={f} value={draft[f.id]} onChange={(v) => setDraft((x) => ({ ...x, [f.id]: v }))} />
              </Field>
            </div>
          ))}
        </div>
      ) : (
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {editable.map((f) => {
            const v = initial[f.id];
            const empty = isEmptyValue(v);
            return (
              <div key={f.id} className={wide(f.field_type)}>
                <dt className="text-xs text-muted-foreground">
                  {labelOf(f)}
                  {f.is_required && <span className="text-destructive"> *</span>}
                </dt>
                <dd className="mt-1 whitespace-pre-line text-sm">
                  {empty ? (
                    <span className={f.is_required ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}>
                      {f.is_required ? "Не заполнено" : "—"}
                    </span>
                  ) : (
                    formatValue(f.field_type, v)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {orphanValues.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-2">
          {orphanValues.map((v) => (
            <div key={v.field_id}>
              <dt className="text-xs text-muted-foreground">{v.label} (поле больше не используется)</dt>
              <dd className="mt-1 whitespace-pre-line text-sm">{formatValue(v.field_type, v.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {mode && editable.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="h-9 px-4 text-sm">
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
          {hasValues && (
            <Button variant="outline" onClick={cancel} disabled={save.isPending} className="h-9 text-sm">
              Отмена
            </Button>
          )}
          {!dirty && <span className="text-sm text-muted-foreground">Изменений нет</span>}
        </div>
      )}
    </section>
  );
}
