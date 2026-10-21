import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Reorderable } from "./Reorderable";
import { CONDITION_KINDS, useDocumentsShort } from "./data";

type Cond = {
  id: string;
  title: string;
  kind: "check" | "file" | "field";
  is_required: boolean;
  to_id_folder: boolean;
  document_id: string | null;
  sort: number;
};

const NONE = "__none";

export function StageConditions({ templateId, readOnly }: { templateId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const key = ["dir-stage-conditions", templateId];
  const { data: docs = [] } = useDocumentsShort();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_template_conditions")
        .select("id, title, kind, is_required, to_id_folder, document_id, sort")
        .eq("template_id", templateId)
        .is("deleted_at", null)
        .order("sort");
      if (error) throw error;
      return (data ?? []) as Cond[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["dir-stage-condition-counts"] });
  };

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Cond, "id">> }) => {
      const { error } = await supabase.from("stage_template_conditions").update(patch).eq("id", id);
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
        .from("stage_template_conditions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Условие удалено");
      refresh();
    },
    onError: showError,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      // оптимистично показываем новый порядок
      qc.setQueryData<Cond[]>(key, (old) =>
        ids.map((id, i) => ({ ...(old ?? []).find((c) => c.id === id)!, sort: i + 1 })),
      );
      const results = await Promise.all(
        ids.map((id, i) => supabase.from("stage_template_conditions").update({ sort: i + 1 }).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: refresh,
    onError: showError,
  });

  const [newTitle, setNewTitle] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const title = newTitle.trim();
      if (!title) throw new Error("Введите название условия");
      const sort = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
      const { error } = await supabase
        .from("stage_template_conditions")
        .insert({ template_id: templateId, title, kind: "check", is_required: true, sort });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      refresh();
    },
    onError: showError,
  });

  if (isLoading) return null;

  return (
    <div className="max-w-5xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Этап нельзя отправить на проверку и закрыть, пока не отмечены все обязательные условия. Для типа «Файл» к
        условию нужно прикрепить файл, для типа «Поле» — заполнить значение.
      </p>
      {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Условий пока нет</p>}
      <Reorderable
        items={rows}
        disabled={readOnly}
        onMove={(ids) => reorder.mutate(ids)}
        render={(c, i) => (
          <ConditionRow
            key={c.id}
            cond={c}
            index={i}
            docs={docs}
            readOnly={readOnly}
            onPatch={(patch) => update.mutate({ id: c.id, patch })}
            onDelete={() => remove.mutate(c.id)}
          />
        )}
      />
      {!readOnly && (
        <form
          className="flex flex-wrap gap-3 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Новое условие, например «Акт получен»"
            className="h-9 min-w-64 flex-1 text-sm"
          />
          <Button type="submit" disabled={add.isPending} className="h-9 px-4 text-sm">
            <Plus className="size-4" /> Добавить условие
          </Button>
        </form>
      )}
    </div>
  );
}

function ConditionRow({
  cond,
  index,
  docs,
  readOnly,
  onPatch,
  onDelete,
}: {
  cond: Cond;
  index: number;
  docs: { id: string; name: string; section: string }[];
  readOnly: boolean;
  onPatch: (patch: Partial<Omit<Cond, "id">>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(cond.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">{index + 1}.</span>
        <Input
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim();
            if (!t) {
              toast.error("Название условия не может быть пустым");
              setTitle(cond.title);
              return;
            }
            if (t !== cond.title) onPatch({ title: t });
          }}
          className="h-9 flex-1 text-sm"
        />
        {!readOnly &&
          (confirmDelete ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="destructive" className="h-9 text-sm" onClick={onDelete}>
                Удалить
              </Button>
              <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setConfirmDelete(false)}>
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
              aria-label="Удалить условие"
            >
              <Trash2 className="size-4" />
            </Button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pl-9">
        <Select value={cond.kind} onValueChange={(v) => onPatch({ kind: v as Cond["kind"] })} disabled={readOnly}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONDITION_KINDS.map((k) => (
              <SelectItem key={k.v} value={k.v} className="text-sm">{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={cond.is_required} onCheckedChange={(v) => onPatch({ is_required: v })} disabled={readOnly} />
          Обязательное
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={cond.to_id_folder} onCheckedChange={(v) => onPatch({ to_id_folder: v })} disabled={readOnly} />
          В папку ИД
        </label>
        <Select
          value={cond.document_id ?? NONE}
          onValueChange={(v) => onPatch({ document_id: v === NONE ? null : v })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 min-w-56 max-w-md flex-1 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="text-sm">Документ не привязан</SelectItem>
            {docs.map((d) => (
              <SelectItem key={d.id} value={d.id} className="text-sm">{d.section}: {d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
