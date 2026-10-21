import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { formatDate, showError } from "@/lib/format";
import { mskToday } from "@/lib/dates";
import { uploadFile } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/directories/common";
import { useRequestFields, useRequestTypes } from "@/components/directories/request-types/data";
import { useObjects } from "@/components/objects/data";
import { useObjectStages } from "@/components/stages/data";
import { FieldInput, isEmptyValue } from "@/components/requests/FieldInput";
import { useRefreshRequests, useRepresentatives } from "@/components/requests/data";

export const Route = createFileRoute("/_authenticated/requests_/new")({
  validateSearch: (s: Record<string, unknown>): { object?: string; type?: string } => ({
    ...(typeof s["object"] === "string" ? { object: s["object"] } : {}),
    ...(typeof s["type"] === "string" ? { type: s["type"] } : {}),
  }),
  component: NewRequestPage,
  head: () => ({ meta: [{ title: "Новая заявка — Лидер" }] }),
});

const NONE = "__none";

function NewRequestPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const me = useProfile();
  const refresh = useRefreshRequests();
  const { data: objects = [] } = useObjects();
  const { data: types = [] } = useRequestTypes();
  const { data: reps = [] } = useRepresentatives();

  const [objectId, setObjectId] = useState(search.object ?? "");
  const [typeId, setTypeId] = useState(search.type ?? "");
  const [callDate, setCallDate] = useState("");
  const [repId, setRepId] = useState("");
  const [stageId, setStageId] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const type = types.find((t) => t.id === typeId);
  const { data: allFields = [] } = useRequestFields(typeId || undefined);
  const fields = typeId ? allFields.filter((f) => f.is_active && f.filled_by === "initiator") : [];
  const hasFileField = fields.some((f) => f.field_type === "file");
  const { data: stages = [] } = useObjectStages(objectId);
  const openStages = objectId ? stages.filter((s) => !s.is_closed && !s.is_excluded) : [];
  const activeObjects = objects.filter((o) => o.status !== "completed");

  const create = useMutation({
    mutationFn: async () => {
      if (!objectId) throw new Error("Выберите объект");
      if (!typeId) throw new Error("Выберите вид заявки");
      if (!callDate) throw new Error("Укажите дату вызова");
      if (type?.uses_representatives && !repId) throw new Error("Выберите, кого вызываем");
      const missing = fields.filter((f) => f.is_required && f.field_type !== "file" && isEmptyValue(values[f.id]));
      if (missing.length) throw new Error(`Заполните: ${missing.map((f) => f.label).join(", ")}`);
      const requiredFile = fields.find((f) => f.is_required && f.field_type === "file");
      if (requiredFile && files.length === 0) throw new Error(`Прикрепите: ${requiredFile.label}`);

      const p_values = fields
        .filter((f) => f.field_type !== "file" && !isEmptyValue(values[f.id]))
        .map((f) => ({ field_id: f.id, value: values[f.id] }));
      const args: {
        p_object_id: string;
        p_request_type_id: string;
        p_call_date: string;
        p_values: { field_id: string; value: unknown }[];
        p_representative_id?: string;
        p_stage_id?: string;
      } = { p_object_id: objectId, p_request_type_id: typeId, p_call_date: callDate, p_values };
      if (repId) args.p_representative_id = repId;
      if (stageId) args.p_stage_id = stageId;
      const { data, error } = await supabase.rpc("request_create", args as never);
      if (error) throw error;
      const id = data as string;
      for (const file of files) {
        await uploadFile({ objectId, entityType: "request_field", entityId: id, kind: "photo", file, profileId: me.id });
      }
      return id;
    },
    onSuccess: (id) => {
      toast.success("Заявка создана");
      refresh(id);
      navigate({ to: "/requests/$requestId", params: { requestId: id }, replace: true });
    },
    onError: showError,
  });

  const back = search.object ? (
    <Link
      to="/objects/$id"
      params={{ id: search.object }}
      search={{ tab: "requests", ...(search.type ? { type: search.type } : {}) }}
      className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <ArrowLeft className="size-4" /> К объекту
    </Link>
  ) : (
    <Link to="/requests" className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
      <ArrowLeft className="size-4" /> К заявкам
    </Link>
  );

  return (
    <div className="max-w-3xl pb-10">
      {back}
      <h1 className="mb-2 text-xl font-bold">Новая заявка{type ? `: ${type.name}` : ""}</h1>
      <p className="mb-4 text-sm text-muted-foreground">Дата формирования: сегодня, {formatDate(mskToday())}</p>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Объект" required>
            <Select value={objectId} onValueChange={(v) => { setObjectId(v); setStageId(""); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите объект" /></SelectTrigger>
              <SelectContent>
                {activeObjects.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-sm">{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Вид заявки" required>
            <Select value={typeId} onValueChange={(v) => { setTypeId(v); setValues({}); setRepId(""); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите вид" /></SelectTrigger>
              <SelectContent>
                {types.filter((t) => t.is_active).map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Дата вызова" required>
          <Input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)} className="h-9 w-60 text-sm" />
        </Field>

        {type?.uses_representatives && (
          <Field label="Кого вызываем" required>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите из справочника" /></SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {fields
          .filter((f) => f.field_type !== "file")
          .map((f) => (
            <Field key={f.id} label={f.label} required={f.is_required}>
              <FieldInput field={f} value={values[f.id]} onChange={(v) => setValues((x) => ({ ...x, [f.id]: v }))} />
            </Field>
          ))}

        {hasFileField && (
          <Field
            label={fields.filter((f) => f.field_type === "file").map((f) => f.label).join(", ")}
            required={fields.some((f) => f.field_type === "file" && f.is_required)}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((x) => [...x, ...picked]);
                e.target.value = "";
              }}
            />
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Убрать">
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="h-9 text-sm">
                <Paperclip className="size-4" /> Добавить файлы
              </Button>
            </div>
          </Field>
        )}

        {objectId && openStages.length > 0 && (
          <Field label="Связать с этапом (необязательно)">
            <Select value={stageId || NONE} onValueChange={(v) => setStageId(v === NONE ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-sm">— без этапа —</SelectItem>
                {openStages.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-sm">{s.number}. {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Button type="submit" disabled={create.isPending} className="h-10 px-5 text-base">
          {create.isPending ? "Создание…" : "Создать заявку"}
        </Button>
      </form>
    </div>
  );
}
