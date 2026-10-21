import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REQUEST_STATUSES, type RequestRow } from "../data";

/** Ход заявки: пять шагов, одна крупная кнопка следующего действия, шаг назад с причиной (ТЗ 7.7). */
export function RequestProgress({
  r,
  doneByName,
  missingRequired,
  onChanged,
}: {
  r: RequestRow;
  doneByName: string | null;
  /** Незаполненные обязательные поля — подсказка до «Готова к отправке». */
  missingRequired: string[];
  onChanged: () => void;
}) {
  const idx = REQUEST_STATUSES.findIndex((s) => s.v === r.status);
  const next = REQUEST_STATUSES[idx + 1];
  const prev = idx > 0 ? REQUEST_STATUSES[idx - 1] : undefined;
  const [result, setResult] = useState(r.result_text ?? "");
  const [back, setBack] = useState(false);
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: async ({ to, comment }: { to: string; comment?: string }) => {
      const args: { p_request_id: string; p_status: string; p_comment?: string } = { p_request_id: r.id, p_status: to };
      if (comment) args.p_comment = comment;
      const { error } = await supabase.rpc("request_set_status", args);
      if (error) throw error;
      return to;
    },
    onSuccess: (to) => {
      toast.success(to === "done" ? "Заявка исполнена" : "Статус изменён");
      setBack(false);
      setReason("");
      onChanged();
    },
    onError: showError,
  });

  /** Строки под шагом: когда и кто. Каждая — отдельной строкой, без разделителей. */
  const when = (v: string): string[] => {
    const lines = (...x: (string | null | undefined)[]) => x.filter((y): y is string => !!y);
    if (v === "new") return lines(formatDateTime(r.created_at), r.initiator_name);
    if (v === "ready") return lines(r.office_name && `Обработал: ${r.office_name}`);
    if (v === "sent") return lines(formatDateTime(r.sent_at));
    if (v === "accepted") return lines(formatDateTime(r.accepted_at));
    if (v === "done") return lines(formatDateTime(r.done_at), doneByName);
    return [];
  };

  const blockedReady = next?.v === "ready" && missingRequired.length > 0;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold">Ход заявки</h2>
      <ol className="mb-4 grid gap-3 sm:grid-cols-5">
        {REQUEST_STATUSES.map((s, i) => {
          const done = i <= idx;
          const current = i === idx;
          return (
            <li
              key={s.v}
              className={`rounded-md border p-3 ${
                current ? "border-primary bg-accent" : done ? "border-emerald-700/25 bg-emerald-50/70 dark:bg-emerald-950/30" : "border-border bg-card text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    done ? "bg-emerald-700 text-white" : "border border-current"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.label}
              </div>
              {done &&
                when(s.v).map((line) => (
                  <div key={line} className="mt-1 text-xs text-muted-foreground">
                    {line}
                  </div>
                ))}
            </li>
          );
        })}
      </ol>

      {r.status === "done" ? (
        <div className="text-sm">
          <p className="inline-flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
            <Check className="size-4" /> Исполнена
          </p>
          {r.result_text && <p className="mt-1">Результат: {r.result_text}</p>}
        </div>
      ) : (
        next && (
          <div className="space-y-3">
            {next.v === "done" && (
              <Input
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Результат / номер протокола (необязательно)"
                className="h-9 max-w-xl text-sm"
              />
            )}
            <Button
              onClick={() => m.mutate({ to: next.v, ...(next.v === "done" && result.trim() ? { comment: result.trim() } : {}) })}
              disabled={m.isPending || blockedReady}
              className="h-10 px-5 text-base"
            >
              {next.next}
            </Button>
            {blockedReady && (
              <p className="text-sm text-muted-foreground">
                Сначала заполните обязательные поля: {missingRequired.join(", ")}.
              </p>
            )}
          </div>
        )
      )}

      {prev && (
        <Button variant="ghost" onClick={() => setBack(true)} className="mt-4 h-9 text-sm text-muted-foreground">
          <Undo2 className="size-4" /> Вернуть на шаг назад («{prev.label}»)
        </Button>
      )}

      <Dialog open={back} onOpenChange={setBack}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Вернуть на шаг «{prev?.label}»</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) {
                toast.error("Укажите причину");
                return;
              }
              if (prev) m.mutate({ to: prev.v, comment: reason.trim() });
            }}
          >
            <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина — обязательно" rows={3} className="text-sm" />
            <div className="flex gap-3">
              <Button type="submit" disabled={m.isPending} className="h-9 flex-1 text-sm">Вернуть</Button>
              <Button type="button" variant="outline" onClick={() => setBack(false)} className="h-9 flex-1 text-sm">Отмена</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
