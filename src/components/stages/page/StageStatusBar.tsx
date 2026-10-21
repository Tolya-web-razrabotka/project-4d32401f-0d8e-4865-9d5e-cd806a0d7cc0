import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { formatDate, showError } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ObjectStage, StageCondition } from "../data";

type Action = { to: string; label: string; primary?: boolean };

const WORKING = ["in_work", "sent", "waiting_visit", "on_approval"];

/** Какие кнопки показывать при текущем статусе (ТЗ 7.6). */
function actionsFor(status: string): Action[] {
  if (status === "not_started") return [{ to: "in_work", label: "Взять в работу", primary: true }];
  if (WORKING.includes(status)) {
    return [
      { to: "sent", label: "Отправлено" },
      { to: "waiting_visit", label: "Ожидание выезда" },
      { to: "on_approval", label: "На согласовании" },
      { to: "on_review", label: "Готово — на проверку", primary: true },
    ].filter((a) => a.to !== status);
  }
  return [];
}

export function StageStatusBar({
  stage,
  conditions,
  onChanged,
}: {
  stage: ObjectStage;
  conditions: StageCondition[];
  onChanged: () => void;
}) {
  const me = useProfile();
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");

  const setStatus = useMutation({
    mutationFn: async ({ to, comment }: { to: string; comment?: string }) => {
      const args: { p_stage_id: string; p_status: string; p_comment?: string } = { p_stage_id: stage.id, p_status: to };
      if (comment) args.p_comment = comment;
      const { error } = await supabase.rpc("stage_set_status", args);
      if (error) throw error;
      return to;
    },
    onSuccess: (to) => {
      toast.success(to === "closed" ? "Этап закрыт" : to === "in_work" && stage.status_code === "on_review" ? "Возвращён на доработку" : "Статус изменён");
      setReturning(false);
      setReason("");
      onChanged();
    },
    onError: showError,
  });

  if (stage.is_excluded) {
    return <Bar><p className="text-sm text-muted-foreground">Этап исключён из работы на этом объекте.</p></Bar>;
  }
  if (stage.status_code === "closed") {
    return (
      <Bar>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Этап закрыт {stage.closed_at ? formatDateTime(stage.closed_at) : ""}
        </p>
      </Bar>
    );
  }

  const missing = conditions.filter((c) => c.is_required && !c.is_done);
  const missingText = missing.length
    ? `Не выполнены условия: ${missing.map((c) => `«${c.title}»`).join(", ")}`
    : "";
  const canClose = me.is_admin || (stage.confirmer_id !== null && stage.confirmer_id === me.id);

  return (
    <Bar>
      <div className="flex flex-wrap gap-3">
        {actionsFor(stage.status_code).map((a) => {
          const blocked = a.to === "on_review" && missing.length > 0;
          return (
            <Button
              key={a.to}
              variant={a.primary ? "default" : "outline"}
              disabled={blocked || setStatus.isPending}
              title={blocked ? missingText : undefined}
              onClick={() => setStatus.mutate({ to: a.to })}
              className="h-10 px-4 text-sm"
            >
              {a.label}
            </Button>
          );
        })}
        {stage.status_code === "on_review" && (
          <>
            <Button
              disabled={!canClose || setStatus.isPending}
              title={canClose ? undefined : "Закрыть этап может только адресат или руководитель"}
              onClick={() => setStatus.mutate({ to: "closed" })}
              className="h-10 bg-green-600 px-4 text-sm text-white hover:bg-green-700"
            >
              Принять и закрыть
            </Button>
            <Button variant="outline" onClick={() => setReturning(true)} className="h-10 border-orange-500 px-4 text-sm text-orange-700 dark:text-orange-300">
              Вернуть на доработку
            </Button>
          </>
        )}
      </div>
      {/* На планшете нет наведения — подсказку показываем текстом */}
      {WORKING.includes(stage.status_code) && missing.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">«Готово — на проверку» станет доступно после выполнения условий. {missingText}.</p>
      )}
      {stage.status_code === "on_review" && !canClose && (
        <p className="mt-2 text-sm text-muted-foreground">Закрыть этап может только адресат или руководитель.</p>
      )}
      {stage.due_date && (
        <p className="mt-2 text-sm text-muted-foreground">Срок окончания: {formatDate(stage.due_date)}</p>
      )}

      <Dialog open={returning} onOpenChange={setReturning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Вернуть на доработку</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) {
                toast.error("Укажите причину возврата");
                return;
              }
              setStatus.mutate({ to: "in_work", comment: reason.trim() });
            }}
          >
            <Textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Что нужно исправить — обязательно"
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-3">
              <Button type="submit" disabled={setStatus.isPending} className="h-9 flex-1 text-sm">Вернуть</Button>
              <Button type="button" variant="outline" onClick={() => setReturning(false)} className="h-9 flex-1 text-sm">
                Отмена
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Bar>
  );
}

function Bar({ children }: { children: ReactNode }) {
  return <div className="mt-6 rounded-lg border-2 bg-card p-4">{children}</div>;
}
