import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { useObject } from "@/components/objects/data";
import { ObjectHeader } from "@/components/objects/ObjectHeader";

export const Route = createFileRoute("/_authenticated/objects_/$id")({
  component: ObjectPage,
  head: () => ({ meta: [{ title: "Объект — Лидер" }] }),
});

function ObjectPage() {
  const { id } = Route.useParams();
  const { is_admin } = useProfile();
  const { data: o, isLoading } = useObject(id);
  const { data: stages = [] } = useQuery({
    queryKey: ["object-stages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_object_stages")
        .select("id, number, name, status_name, status_color, is_excluded")
        .eq("object_id", id)
        .order("sort")
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const back = (
    <Link to="/objects" className="mb-4 inline-flex items-center gap-2 text-lg text-primary hover:underline">
      <ArrowLeft className="size-5" /> К объектам
    </Link>
  );

  if (isLoading) return <div className="text-xl text-muted-foreground">Загрузка…</div>;
  if (!o) {
    return (
      <div>
        {back}
        <p className="py-10 text-xl text-muted-foreground">Объект не найден или у вас нет к нему доступа</p>
      </div>
    );
  }

  return (
    <div>
      {back}
      <ObjectHeader
        o={o}
        actions={
          is_admin && (
            <Button asChild variant="outline" className="h-12 text-lg">
              <Link to="/objects/$id/edit" params={{ id }}>
                <Pencil className="size-5" /> Редактировать
              </Link>
            </Button>
          )
        }
      />
      <h2 className="mb-3 text-2xl font-semibold">
        Этапы <span className="font-normal text-muted-foreground">· {stages.filter((s) => !s.is_excluded).length}</span>
      </h2>
      <div className="divide-y rounded-lg border">
        {stages.length === 0 && <p className="p-6 text-lg text-muted-foreground">Этапов нет</p>}
        {stages.map((s) => (
          <div key={s.id} className={`flex items-center gap-4 px-4 py-3 text-lg ${s.is_excluded ? "opacity-50" : ""}`}>
            <span className="w-8 font-semibold">{s.number}</span>
            <span className="flex-1">{s.name}</span>
            {s.is_excluded ? (
              <span className="text-base text-muted-foreground">исключён</span>
            ) : (
              <span
                className="rounded-full px-3 py-0.5 text-base font-medium text-white"
                style={{ backgroundColor: s.status_color ?? "#9CA3AF" }}
              >
                {s.status_name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
