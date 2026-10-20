import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, showError } from "@/lib/format";
import { listFiles } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/directories/common";
import { useRequestFields } from "@/components/directories/request-types/data";
import { useActiveProfiles } from "@/components/objects/data";
import { HistoryFeed } from "@/components/history/HistoryFeed";
import { FileList, UploadButton } from "@/components/stages/page/FileButtons";
import { isEmptyValue } from "@/components/requests/FieldInput";
import { RequestStatusBadge, overdueDays, useRefreshRequests, type FieldValue, type RequestRow } from "@/components/requests/data";
import { RequestFieldsBlock } from "@/components/requests/card/RequestFieldsBlock";
import { RequestProgress } from "@/components/requests/card/RequestProgress";
import { RequestComments } from "@/components/requests/card/RequestComments";

export const Route = createFileRoute("/_authenticated/requests_/$requestId")({
  component: RequestCard,
  head: () => ({ meta: [{ title: "Заявка — Лидер" }] }),
});

function RequestCard() {
  const { requestId } = Route.useParams();
  const qc = useQueryClient();
  const refreshAll = useRefreshRequests();
  const { data: r, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_requests").select("*").eq("id", requestId).maybeSingle();
      if (error) throw error;
      return data ? ({ ...(data as unknown as RequestRow), is_new: !!data.is_new, is_overdue: !!data.is_overdue }) : null;
    },
  });
  const { data: values = [] } = useQuery({
    queryKey: ["request", requestId, "values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_field_values")
        .select("request_id, field_id, label, field_type, value")
        .eq("request_id", requestId);
      if (error) throw error;
      return (data ?? []) as FieldValue[];
    },
  });
  const filesKey = ["request", requestId, "files"];
  const { data: files = [] } = useQuery({
    queryKey: filesKey,
    queryFn: async () => {
      const [a, b] = await Promise.all([listFiles("request_field", [requestId]), listFiles("request", [requestId])]);
      return [...a, ...b].sort((x, y) => y.created_at.localeCompare(x.created_at));
    },
  });
  const { data: fields = [] } = useRequestFields(r?.request_type_id);
  const { data: profiles = [] } = useActiveProfiles();

  const refresh = () => {
    refreshAll(requestId);
    qc.invalidateQueries({ queryKey: ["request", requestId] });
    qc.invalidateQueries({ queryKey: ["request-comments", requestId] });
  };

  if (isLoading) return <div className="text-xl text-muted-foreground">Загрузка…</div>;
  if (!r) {
    return (
      <div>
        <BackLink />
        <p className="py-10 text-xl text-muted-foreground">Заявка не найдена или у вас нет к ней доступа</p>
      </div>
    );
  }

  const active = fields.filter((f) => f.is_active && f.request_type_id === r.request_type_id);
  const activeIds = new Set(active.map((f) => f.id));
  const valueOf = (id: string) => values.find((v) => v.field_id === id)?.value;
  const missingRequired = active
    .filter((f) => f.is_required)
    .filter((f) => (f.field_type === "file" ? files.length === 0 : isEmptyValue(valueOf(f.id))))
    .map((f) => f.label);
  const orphan = values.filter((v) => !activeIds.has(v.field_id) && v.field_type !== "file");
  const doneByName = r.done_by ? profiles.find((p) => p.id === r.done_by)?.full_name ?? null : null;
  const readOnly = r.status === "done";
  const blockKey = JSON.stringify(values);

  return (
    <div className="max-w-5xl space-y-6 pb-10">
      <BackLink objectId={r.object_id} />

      <header className={`rounded-xl border p-5 ${r.is_overdue ? "border-red-400 bg-red-50 dark:bg-red-950/40" : "bg-card"}`}>
        <div className="flex flex-wrap items-start gap-4">
          <h1 className="min-w-0 flex-1 text-3xl font-bold leading-tight">
            Заявка №{r.number} · {r.type_name}
          </h1>
          {r.is_new && <span className="rounded bg-red-600 px-3 py-1 text-lg font-bold text-white">Новая</span>}
          <RequestStatusBadge status={r.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-lg">
          <Link to="/objects/$id" params={{ id: r.object_id }} className="text-primary hover:underline">
            {r.object_name}
          </Link>
          {r.representative_name && <span>Вызываем: {r.representative_name}</span>}
          <span className="text-muted-foreground">Сформирована: {formatDate(r.created_at)}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-xl">
            Дата вызова: <span className="font-semibold">{formatDate(r.call_date)}</span>
          </span>
          {r.is_overdue && (
            <span className="font-semibold text-red-700 dark:text-red-300">не исполнена {overdueDays(r)} дн.</span>
          )}
          {r.status !== "done" && <MoveDate requestId={r.id} current={r.call_date} onDone={refresh} />}
        </div>
        {r.stage_id && <StageLink objectId={r.object_id} stageId={r.stage_id} />}
      </header>

      <RequestProgress r={r} doneByName={doneByName} missingRequired={missingRequired} onChanged={refresh} />

      <RequestFieldsBlock
        key={`i-${blockKey}`}
        title="Данные прораба"
        requestId={r.id}
        fields={active.filter((f) => f.filled_by === "initiator")}
        values={values}
        orphanValues={orphan}
        readOnly={readOnly}
        onSaved={refresh}
      />
      <RequestFieldsBlock
        key={`o-${blockKey}`}
        title="Данные офис-менеджера"
        hint="Заполняются перед отправкой заявки."
        requestId={r.id}
        fields={active.filter((f) => f.filled_by === "office")}
        values={values}
        orphanValues={[]}
        readOnly={readOnly}
        onSaved={refresh}
      />

      <RequestComments requestId={r.id} />

      <section className="rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-2xl font-semibold">Файлы</h2>
          <UploadButton
            objectId={r.object_id}
            entityType="request_field"
            entityId={r.id}
            kind="photo"
            label="Добавить файлы"
            onUploaded={() => {
              qc.invalidateQueries({ queryKey: filesKey });
              qc.invalidateQueries({ queryKey: ["history"] });
            }}
          />
        </div>
        {files.length === 0 ? <p className="text-lg text-muted-foreground">Файлов нет</p> : <FileList files={files} />}
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">История</h2>
        <HistoryFeed filter={{ entityType: "request", entityId: r.id }} />
      </section>
    </div>
  );
}

function BackLink({ objectId }: { objectId?: string }) {
  return objectId ? (
    <Link
      to="/objects/$id"
      params={{ id: objectId }}
      search={{ tab: "requests" }}
      className="inline-flex items-center gap-2 text-lg text-primary hover:underline"
    >
      <ArrowLeft className="size-5" /> К заявкам объекта
    </Link>
  ) : (
    <Link to="/requests" className="inline-flex items-center gap-2 text-lg text-primary hover:underline">
      <ArrowLeft className="size-5" /> К заявкам
    </Link>
  );
}

function StageLink({ objectId, stageId }: { objectId: string; stageId: string }) {
  const { data } = useQuery({
    queryKey: ["stage-short", stageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("object_stages").select("number, name").eq("id", stageId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!data) return null;
  return (
    <div className="mt-3 text-lg">
      Этап:{" "}
      <Link to="/objects/$id/stages/$stageId" params={{ id: objectId, stageId }} className="text-primary hover:underline">
        {data.number}. {data.name}
      </Link>
    </div>
  );
}

/** Перенос даты вызова — только с причиной (request_set_call_date). */
function MoveDate({ requestId, current, onDone }: { requestId: string; current: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Укажите новую дату");
      if (date === current) throw new Error("Дата не изменилась");
      if (!reason.trim()) throw new Error("Укажите причину переноса");
      const { error } = await supabase.rpc("request_set_call_date", {
        p_request_id: requestId,
        p_call_date: date,
        p_comment: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Дата вызова перенесена");
      setOpen(false);
      setReason("");
      onDone();
    },
    onError: showError,
  });
  return (
    <>
      <Button variant="outline" onClick={() => { setDate(current); setOpen(true); }} className="h-11 text-base">
        <CalendarClock className="size-5" /> Перенести
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Перенести дату вызова</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <Field label="Новая дата" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-lg" />
            </Field>
            <Field label="Причина" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="text-lg" />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={m.isPending} className="h-12 flex-1 text-lg">Перенести</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-12 flex-1 text-lg">Отмена</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
