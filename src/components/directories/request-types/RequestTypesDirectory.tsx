import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Reorderable } from "../stages/Reorderable";
import { REQUEST_TYPES_KEY, useRequestFields, useRequestTypes, type RequestType } from "./data";

export function RequestTypesDirectory() {
  const { is_admin } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useRequestTypes();
  const { data: fields = [] } = useRequestFields();

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      qc.setQueryData<RequestType[]>(REQUEST_TYPES_KEY, (old) =>
        ids.map((id, i) => ({ ...(old ?? []).find((t) => t.id === id)!, sort: i + 1 })),
      );
      const results = await Promise.all(
        ids.map((id, i) => supabase.from("request_types").update({ sort: i + 1 }).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: REQUEST_TYPES_KEY }),
    onError: showError,
  });

  const open = (id: string) => navigate({ to: "/directories/request-types/$id", params: { id } });
  const countFields = (id: string) => fields.filter((f) => f.request_type_id === id && f.is_active).length;

  if (isLoading) return null;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Виды заявок — это кнопки на странице объекта, в том же порядке. Нажмите на вид, чтобы настроить его поля.
        </p>
        {is_admin && (
          <Button onClick={() => open("new")} className="h-9 px-4 text-sm">
            <Plus className="size-4" /> Добавить
          </Button>
        )}
      </div>
      <Reorderable
        items={types}
        disabled={!is_admin}
        onMove={(ids) => reorder.mutate(ids)}
        render={(t) => (
          <button
            type="button"
            onClick={() => open(t.id)}
            className={`flex w-full items-center gap-4 rounded-md py-1 text-left ${t.is_active ? "" : "text-muted-foreground"}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold">
                {t.name}
                {!t.is_active && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-xs font-normal text-muted-foreground">неактивен</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>Полей: {countFields(t.id)}</span>
                {t.uses_representatives && <span>Выбор из представителей</span>}
                <span>{t.send_to_email ? `Отправка: ${t.send_to_email}` : "Адрес отправки не указан"}</span>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      />
    </div>
  );
}
