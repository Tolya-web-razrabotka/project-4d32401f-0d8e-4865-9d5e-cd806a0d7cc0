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

  const when = (v: string): string => {
    if (v === "new") return `${formatDateTime(r.created_at)} · ${r.initiator_name ?? ""}`;
    if (v === "ready") return r.office_name ? `обработал: ${r.office_name}` : "";
    if (v === "sent") return formatDateTime(r.sent_at);
    if (v === "accepted") return formatDateTime(r.accepted_at);
    if (v === "done") return [formatDateTime(r.done_at), doneByName].filter(Boolean).join(" · ");
    return "";
  };

  const blockedReady = next?.v === "ready" && missingRequired.length > 0;

  return (
    <section className="rounded-xl border-2 p-5">
      <h2 className="mb-4 text-2xl font-semibold">Ход заявки</h2>
      <ol className="mb-6 grid gap-3 sm:grid-cols-5">
        {REQUEST_STATUSES.map((s, i) => {
          const done = i <= idx;
          const current = i === idx;
          return (
            <li
              key={s.v}
              className={`rounded-lg border-2 p-3 ${
                current ? "border-primary bg-accent" : done ? "border-green-600/40 bg-green-50 dark:bg-green-950/30" : "border-border text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2 text-base font-semibold">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm ${
                    done ? "bg-green-600 text-white" : "border-2 border-current"
                  }`}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                {s.label}
              </div>
              {done && <div className="mt-1 text-sm text-muted-foreground">{when(s.v)}</div>}
            </li>
          );
        })}
      </ol>

      {r.status === "done" ? (
        <p className="text-lg font-medium text-green-700 dark:text-green-400">
          ✓ Исполнена{r.result_text ? ` · Результат: ${r.result_text}` : ""}
        </p>
      ) : (
        next && (
          <div className="space-y-3">
            {next.v === "done" && (
              <Input
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Результат / номер протокола (необязательно)"
                className="h-12 max-w-xl text-lg"
              />
            )}
            <Button
              onClick={() => m.mutate({ to: next.v, ...(next.v === "done" && result.trim() ? { comment: result.trim() } : {}) })}
              disabled={m.isPending || blockedReady}
              className="h-14 px-10 text-xl"
            >
              {next.next}
            </Button>
            {blockedReady && (
              <p className="text-base text-muted-foreground">
                Сначала заполните обязательные поля: {missingRequired.join(", ")}.
              </p>
            )}
          </div>
        )
      )}

      {prev && (
        <Button variant="ghost" onClick={() => setBack(true)} className="mt-4 h-11 text-base text-muted-foreground">
          <Undo2 className="size-5" /> Вернуть на шаг назад («{prev.label}»)
        </Button>
      )}

      <Dialog open={back} onOpenChange={setBack}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Вернуть на шаг «{prev?.label}»</DialogTitle>
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
            <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина — обязательно" rows={3} className="text-lg" />
            <div className="flex gap-3">
              <Button type="submit" disabled={m.isPending} className="h-12 flex-1 text-lg">Вернуть</Button>
              <Button type="button" variant="outline" onClick={() => setBack(false)} className="h-12 flex-1 text-lg">Отмена</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
