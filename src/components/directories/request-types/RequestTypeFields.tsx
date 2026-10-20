import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../common";
import { Reorderable } from "../stages/Reorderable";
import { FIELD_TYPES, FILLED_BY, useRequestFields, type FieldType, type RequestField } from "./data";

type Patch = Partial<Omit<RequestField, "id" | "request_type_id">>;

const parseOptions = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function RequestTypeFields({ typeId, readOnly }: { typeId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const key = ["dir-request-fields", typeId];
  const { data: fields = [], isLoading } = useRequestFields(typeId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["dir-request-fields", "all"] });
  };

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Patch }) => {
      const { error } = await supabase.from("request_type_fields").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => {
      showError(e);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("request_type_fields")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Поле удалено");
      refresh();
    },
    onError: showError,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      qc.setQueryData<RequestField[]>(key, (old) =>
        ids.map((id, i) => ({ ...(old ?? []).find((f) => f.id === id)!, sort: i + 1 })),
      );
      const results = await Promise.all(
        ids.map((id, i) => supabase.from("request_type_fields").update({ sort: i + 1 }).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: refresh,
    onError: showError,
  });

  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [filledBy, setFilledBy] = useState<RequestField["filled_by"]>("initiator");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Укажите подпись поля");
      const opts = parseOptions(options);
      if (type === "select" && opts.length === 0) throw new Error("Для выпадающего списка укажите варианты");
      const sort = fields.reduce((m, f) => Math.max(m, f.sort), 0) + 1;
      const { error } = await supabase.from("request_type_fields").insert({
        request_type_id: typeId,
        label: label.trim(),
        field_type: type,
        options: type === "select" ? opts : [],
        is_required: required,
        filled_by: filledBy,
        sort,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      setOptions("");
      setRequired(false);
      setType("text");
      refresh();
    },
    onError: showError,
  });

  if (isLoading) return null;

  return (
    <div className="max-w-5xl space-y-4">
      <p className="text-base text-muted-foreground">
        Поля, которые заполняет прораб, показываются в форме новой заявки. Поля офис-менеджера дозаполняются в карточке
        заявки. Переименование поля не меняет уже созданные заявки.
      </p>
      {fields.length === 0 && <p className="py-6 text-center text-lg text-muted-foreground">Полей пока нет</p>}
      <Reorderable
        items={fields}
        disabled={readOnly}
        onMove={(ids) => reorder.mutate(ids)}
        render={(f) => (
          <FieldRow
            key={f.id}
            field={f}
            readOnly={readOnly}
            onPatch={(patch) => update.mutate({ id: f.id, patch })}
            onDelete={() => remove.mutate(f.id)}
          />
        )}
      />
      {!readOnly && (
        <form
          className="space-y-4 rounded-lg border border-dashed p-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="text-lg font-semibold">Новое поле</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Подпись" required>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например: Пикеты" className="h-12 text-lg" />
            </Field>
            <Field label="Тип">
              <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                <SelectTrigger className="h-12 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Кто заполняет">
              <Select value={filledBy} onValueChange={(v) => setFilledBy(v as RequestField["filled_by"])}>
                <SelectTrigger className="h-12 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILLED_BY.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-3 self-end pb-3 text-lg">
              <Switch checked={required} onCheckedChange={setRequired} /> Обязательное
            </label>
          </div>
          {type === "select" && (
            <Field label="Варианты — по одному в строке" required>
              <Textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={4} className="text-lg" />
            </Field>
          )}
          <Button type="submit" disabled={add.isPending} className="h-12 px-6 text-lg">
            <Plus className="size-5" /> Добавить поле
          </Button>
        </form>
      )}
    </div>
  );
}

function FieldRow({
  field,
  readOnly,
  onPatch,
  onDelete,
}: {
  field: RequestField;
  readOnly: boolean;
  onPatch: (patch: Patch) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState(field.options.join("\n"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`space-y-3 ${field.is_active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <Input
          value={label}
          disabled={readOnly}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            const t = label.trim();
            if (!t) {
              toast.error("Подпись не может быть пустой");
              setLabel(field.label);
              return;
            }
            if (t !== field.label) onPatch({ label: t });
          }}
          className="h-11 flex-1 text-lg font-medium"
        />
        {!readOnly &&
          (confirmDelete ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="destructive" className="h-11 text-base" onClick={onDelete}>
                Удалить
              </Button>
              <Button type="button" variant="outline" className="h-11 text-base" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Удалить поле"
            >
              <Trash2 className="size-5" />
            </Button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Select
          value={field.field_type}
          onValueChange={(v) => onPatch({ field_type: v as FieldType })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-10 w-56 text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={field.filled_by}
          onValueChange={(v) => onPatch({ filled_by: v as RequestField["filled_by"] })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-10 w-56 text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILLED_BY.map((t) => (
              <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-base">
          <Switch checked={field.is_required} onCheckedChange={(v) => onPatch({ is_required: v })} disabled={readOnly} />
          Обязательное
        </label>
        <label className="flex items-center gap-2 text-base">
          <Switch checked={field.is_active} onCheckedChange={(v) => onPatch({ is_active: v })} disabled={readOnly} />
          Активно
        </label>
      </div>
      {field.field_type === "select" && (
        <div className="space-y-1">
          <div className="text-base text-muted-foreground">Варианты — по одному в строке</div>
          <Textarea
            value={options}
            disabled={readOnly}
            rows={3}
            onChange={(e) => setOptions(e.target.value)}
            onBlur={() => {
              const opts = parseOptions(options);
              if (opts.join("\n") !== field.options.join("\n")) onPatch({ options: opts });
            }}
            className="text-base"
          />
          {field.options.length === 0 && (
            <p className="text-base text-destructive">Добавьте хотя бы один вариант, иначе выбрать будет нечего</p>
          )}
        </div>
      )}
    </div>
  );
}
