import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OBJECTS_KEY } from "@/components/objects/data";
import { ObjectCardFields, draftToPayload, validateDraft, type ObjectDraft } from "@/components/objects/ObjectCardFields";
import { MembersPicker } from "@/components/objects/MembersPicker";
import { StagesPicker, useAvailableTemplates } from "@/components/objects/StagesPicker";

export const Route = createFileRoute("/_authenticated/objects_/$id_/edit")({
  component: EditObjectPage,
  head: () => ({ meta: [{ title: "Редактирование объекта — Лидер" }] }),
});

const TAB_CLASS =
  "h-12 border px-5 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

function EditObjectPage() {
  const { id } = Route.useParams();
  const { is_admin } = useProfile();
  const { data: obj, isLoading } = useQuery({
    queryKey: ["object-raw", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objects")
        .select("id, name, address, customer_id, object_type, contract_start, contract_end, responsible_id, status, notes")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const back = (
    <Link to="/objects/$id" params={{ id }} className="mb-4 inline-flex items-center gap-2 text-lg text-primary hover:underline">
      <ArrowLeft className="size-5" /> К объекту
    </Link>
  );

  if (isLoading) return <div className="text-xl text-muted-foreground">Загрузка…</div>;
  if (!obj || !is_admin) {
    return (
      <div>
        {back}
        <p className="py-10 text-xl text-muted-foreground">
          {obj ? "Редактировать объект может только администратор или руководитель" : "Объект не найден"}
        </p>
      </div>
    );
  }

  const draft: ObjectDraft = {
    name: obj.name,
    address: obj.address ?? "",
    customer_id: obj.customer_id ?? "",
    object_type: obj.object_type as ObjectDraft["object_type"],
    contract_start: obj.contract_start ?? "",
    contract_end: obj.contract_end ?? "",
    responsible_id: obj.responsible_id ?? "",
    status: obj.status as ObjectDraft["status"],
    notes: obj.notes ?? "",
  };

  return (
    <div>
      {back}
      <h1 className="mb-6 text-3xl font-bold">{obj.name}</h1>
      <Tabs defaultValue="card">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="card" className={TAB_CLASS}>Карточка</TabsTrigger>
          <TabsTrigger value="members" className={TAB_CLASS}>Участники</TabsTrigger>
          <TabsTrigger value="stages" className={TAB_CLASS}>Этапы</TabsTrigger>
        </TabsList>
        <TabsContent value="card">
          <CardTab id={id} initial={draft} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab id={id} />
        </TabsContent>
        <TabsContent value="stages">
          <StagesTab id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useInvalidateObject(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: OBJECTS_KEY });
    qc.invalidateQueries({ queryKey: ["object-raw", id] });
    qc.invalidateQueries({ queryKey: ["object-stages", id] });
    qc.invalidateQueries({ queryKey: ["object-members", id] });
  };
}

function CardTab({ id, initial }: { id: string; initial: ObjectDraft }) {
  const [draft, setDraft] = useState(initial);
  const invalidate = useInvalidateObject(id);

  const save = useMutation({
    mutationFn: async (override?: Partial<ObjectDraft>) => {
      const d = { ...draft, ...override };
      const err = validateDraft(d);
      if (err) throw new Error(err);
      const payload = draftToPayload(d);
      const { error } = await supabase
        .from("objects")
        .update({
          ...payload,
          completed_at: payload.status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      return d;
    },
    onSuccess: (d) => {
      setDraft(d);
      toast.success(d.status === "completed" && initial.status !== "completed" ? "Объект перенесён в архив" : "Сохранено");
      invalidate();
    },
    onError: showError,
  });

  const archived = draft.status === "completed";

  return (
    <div className="space-y-6">
      <ObjectCardFields value={draft} onChange={setDraft} showStatus />
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => save.mutate(undefined)} disabled={save.isPending} className="h-12 px-10 text-lg">
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </Button>
        {archived ? (
          <Button variant="outline" onClick={() => save.mutate({ status: "in_work" })} disabled={save.isPending} className="h-12 text-lg">
            <ArchiveRestore className="size-5" /> Вернуть из архива
          </Button>
        ) : (
          <Button variant="outline" onClick={() => save.mutate({ status: "completed" })} disabled={save.isPending} className="h-12 text-lg">
            <Archive className="size-5" /> Завершить и перенести в архив
          </Button>
        )}
      </div>
    </div>
  );
}

function MembersTab({ id }: { id: string }) {
  const invalidate = useInvalidateObject(id);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["object-members", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("object_members").select("profile_id").eq("object_id", id);
      if (error) throw error;
      return (data ?? []).map((r) => r.profile_id as string);
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ profileId, on }: { profileId: string; on: boolean }) => {
      const { error } = on
        ? await supabase.from("object_members").insert({ object_id: id, profile_id: profileId })
        : await supabase.from("object_members").delete().eq("object_id", id).eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: showError,
  });
  if (isLoading) return null;
  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">
        Изменения сохраняются сразу. Участник видит объект, его этапы и заявки.
      </p>
      <MembersPicker
        value={members}
        disabled={toggle.isPending}
        onToggle={(profileId, on) => toggle.mutate({ profileId, on })}
      />
    </div>
  );
}

function StagesTab({ id }: { id: string }) {
  const invalidate = useInvalidateObject(id);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["object-stages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_object_stages")
        .select("id, number, name, status_name, status_color, is_excluded, template_id")
        .eq("object_id", id)
        .order("sort")
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { templates } = useAvailableTemplates(stages.map((s) => s.template_id).filter((x): x is string => !!x));

  const exclude = useMutation({
    mutationFn: async ({ stageId, excluded }: { stageId: string; excluded: boolean }) => {
      const { error } = await supabase.rpc("stage_set_excluded", { p_stage_id: stageId, p_excluded: excluded });
      if (error) throw error;
      return excluded;
    },
    onSuccess: (excluded) => {
      toast.success(excluded ? "Этап исключён из работы" : "Этап возвращён в работу");
      invalidate();
    },
    onError: showError,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (picked.length === 0) throw new Error("Отметьте хотя бы один этап");
      const { data, error } = await supabase.rpc("add_object_stages", { p_object_id: id, p_template_ids: picked });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`Добавлено этапов: ${n}`);
      setAdding(false);
      setPicked([]);
      invalidate();
    },
    onError: showError,
  });

  if (isLoading) return null;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-base text-muted-foreground">
          Исключённый этап не учитывается в готовности и не подсвечивается. Его можно вернуть в любой момент.
        </p>
        <Button onClick={() => setAdding(true)} className="h-12 px-6 text-lg">
          <Plus className="size-5" /> Добавить этапы из справочника
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {stages.length === 0 && <p className="p-6 text-lg text-muted-foreground">Этапов нет</p>}
        {stages.map((s) => (
          <div key={s.id} className={`flex flex-wrap items-center gap-4 px-4 py-3 text-lg ${s.is_excluded ? "bg-muted/50" : ""}`}>
            <span className="w-8 font-semibold">{s.number}</span>
            <span className={`flex-1 ${s.is_excluded ? "text-muted-foreground line-through" : ""}`}>{s.name}</span>
            {!s.is_excluded && (
              <span
                className="rounded-full px-3 py-0.5 text-base font-medium text-white"
                style={{ backgroundColor: s.status_color ?? "#9CA3AF" }}
              >
                {s.status_name}
              </span>
            )}
            <Button
              variant="outline"
              className="h-10 text-base"
              disabled={exclude.isPending}
              onClick={() => exclude.mutate({ stageId: s.id!, excluded: !s.is_excluded })}
            >
              {s.is_excluded ? "Вернуть" : "Исключить"}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Добавить этапы из справочника</DialogTitle>
          </DialogHeader>
          <StagesPicker templates={templates} selected={picked} onChange={setPicked} />
          <div className="flex gap-3 pt-2">
            <Button onClick={() => add.mutate()} disabled={add.isPending || picked.length === 0} className="h-12 px-8 text-lg">
              {add.isPending ? "Добавление…" : `Добавить (${picked.length})`}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)} className="h-12 text-lg">
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
