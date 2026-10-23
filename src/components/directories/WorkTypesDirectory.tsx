import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Reorderable } from "./stages/Reorderable";
import { STAGES_KEY, useStageTemplatesFull, useWorkTypes } from "./stages/data";
import { EditSheet, Field, FormActions } from "./common";

/** Тот же ключ, что у useWorkTypes: список обновляется и в карточке этапа, и в мастере объекта. */
const KEY = ["dir-work-types"];
type WorkType = { id: string; name: string; sort: number };

/**
 * Справочник «Виды работ» (правка раунда 2): группы этапов.
 * Порядок здесь = порядок групп в справочнике этапов, в мастере объекта и в таблице этапов.
 */
export function WorkTypesDirectory() {
  const { is_admin } = useProfile();
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useWorkTypes();
  const { data: stages = [] } = useStageTemplatesFull();
  const [editing, setEditing] = useState<WorkType | "new" | null>(null);

  const count = (id: string) => stages.filter((s) => s.work_type_id === id).length;

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      qc.setQueryData<WorkType[]>(KEY, (old) => ids.map((id, i) => ({ ...(old ?? []).find((t) => t.id === id)!, sort: i + 1 })));
      const results = await Promise.all(ids.map((id, i) => supabase.from("work_types").update({ sort: i + 1 }).eq("id", id)));
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: showError,
  });

  if (isLoading) return null;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Виды работ — это группы этапов. Их выбирают в карточке этапа, по ним сгруппированы этапы в справочнике и на объекте, в этом же порядке.
        </p>
        {is_admin && (
          <Button onClick={() => setEditing("new")} className="h-9 px-4 text-sm">
            <Plus className="size-4" /> Добавить
          </Button>
        )}
      </div>
      {types.length === 0 ? (
        <p className="rounded-md border bg-card py-8 text-center text-sm text-muted-foreground">Видов работ пока нет</p>
      ) : (
        <Reorderable
          items={types}
          disabled={!is_admin}
          onMove={(ids) => reorder.mutate(ids)}
          render={(t) => (
            <button
              type="button"
              disabled={!is_admin}
              onClick={() => setEditing(t)}
              className="flex w-full items-center gap-4 rounded-md py-1 text-left disabled:cursor-default"
            >
              <span className="min-w-0 flex-1 text-sm font-semibold">{t.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">Этапов: {count(t.id)}</span>
            </button>
          )}
        />
      )}
      <EditSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Новый вид работ" : "Вид работ"}
      >
        {editing !== null && (
          <WorkTypeForm
            key={editing === "new" ? "new" : editing.id}
            wt={editing === "new" ? null : editing}
            stagesCount={editing === "new" ? 0 : count(editing.id)}
            nextSort={Math.max(0, ...types.map((t) => t.sort)) + 1}
            onClose={() => setEditing(null)}
          />
        )}
      </EditSheet>
    </div>
  );
}

function WorkTypeForm({
  wt,
  stagesCount,
  nextSort,
  onClose,
}: {
  wt: WorkType | null;
  stagesCount: number;
  nextSort: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(wt?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: STAGES_KEY });
    onClose();
  };

  const save = useMutation({
    mutationFn: async () => {
      const value = name.trim().replace(/\s+/g, " ");
      // Название уникально в базе, в том числе среди удалённых. Удалённый с тем же названием — восстанавливаем.
      const { data: same, error: e1 } = await supabase.from("work_types").select("id, deleted_at").ilike("name", value.replace(/[\\%_]/g, (c) => `\\${c}`));
      if (e1) throw e1;
      const other = (same ?? []).find((r) => r.id !== wt?.id);
      if (other && !other.deleted_at) throw new Error(`Вид работ «${value}» уже есть`);
      if (other && !wt) {
        const { error } = await supabase.from("work_types").update({ name: value, deleted_at: null, sort: nextSort }).eq("id", other.id);
        if (error) throw error;
        return;
      }
      if (other) throw new Error(`Название «${value}» было у удалённого вида работ — выберите другое`);
      const { error } = wt
        ? await supabase.from("work_types").update({ name: value }).eq("id", wt.id)
        : await supabase.from("work_types").insert({ name: value, sort: nextSort });
      if (error) throw error;
    },
    onSuccess: () => done("Сохранено"),
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: async () => {
      // Проверяем ещё раз на сервере: этапы могли добавить, пока форма была открыта
      const { count, error: e1 } = await supabase
        .from("stage_templates")
        .select("id", { count: "exact", head: true })
        .eq("work_type_id", wt!.id)
        .is("deleted_at", null);
      if (e1) throw e1;
      if (count) throw new Error(`К виду работ привязано этапов: ${count}. Сначала переведите их в другой вид работ`);
      const { error } = await supabase.from("work_types").update({ deleted_at: new Date().toISOString() }).eq("id", wt!.id);
      if (error) throw error;
    },
    onSuccess: () => done("Удалено"),
    onError: (e) => {
      setConfirmDelete(false);
      showError(e);
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) { toast.error("Заполните название"); return; }
        save.mutate();
      }}
    >
      <Field label="Название" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" autoFocus />
      </Field>
      {wt && (
        <p className="text-sm text-muted-foreground">
          Этапов в справочнике с этим видом работ: {stagesCount}. Новое название сразу появится у них и на объектах.
        </p>
      )}
      <FormActions pending={save.isPending} onCancel={onClose} />
      {wt && (
        <div className="space-y-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={stagesCount > 0}
            onClick={() => setConfirmDelete(true)}
            className="h-9 text-sm text-destructive"
          >
            <Trash2 className="size-4" /> Удалить
          </Button>
          {stagesCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Удалить можно, когда к виду работ не привязано ни одного этапа: переведите их в другой вид работ в карточке этапа.
            </p>
          )}
        </div>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Удалить вид работ?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              «{wt?.name}» пропадёт из списка. На уже созданных объектах этапы останутся как есть.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-sm">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-destructive text-sm text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
