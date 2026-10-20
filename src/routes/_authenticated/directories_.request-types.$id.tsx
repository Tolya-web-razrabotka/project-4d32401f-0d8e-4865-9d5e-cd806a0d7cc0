import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestTypes } from "@/components/directories/request-types/data";
import { RequestTypeForm } from "@/components/directories/request-types/RequestTypeForm";
import { RequestTypeFields } from "@/components/directories/request-types/RequestTypeFields";

export const Route = createFileRoute("/_authenticated/directories_/request-types/$id")({
  component: RequestTypeCardPage,
  head: () => ({ meta: [{ title: "Вид заявки — Лидер" }] }),
});

const TAB_CLASS =
  "h-12 border px-5 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

function RequestTypeCardPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { is_admin } = useProfile();
  const { data: types = [], isLoading } = useRequestTypes();
  const isNew = id === "new";
  const type = isNew ? null : types.find((t) => t.id === id) ?? null;
  const readOnly = !is_admin;

  const back = (
    <Link
      to="/directories"
      search={{ tab: "request-types" }}
      className="mb-4 inline-flex items-center gap-2 text-lg text-primary hover:underline"
    >
      <ArrowLeft className="size-5" /> К справочнику
    </Link>
  );

  if (isLoading) return <div className="text-xl text-muted-foreground">Загрузка…</div>;
  if ((!isNew && !type) || (isNew && readOnly)) {
    return (
      <div>
        {back}
        <p className="py-10 text-xl text-muted-foreground">
          {isNew ? "Добавлять виды заявок может только администратор" : "Вид заявки не найден или удалён"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {back}
      <h1 className="mb-6 text-3xl font-bold">{type ? type.name : "Новый вид заявки"}</h1>
      <Tabs key={id} defaultValue={isNew ? "main" : "fields"}>
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="fields" className={TAB_CLASS} disabled={isNew}>Поля заявки</TabsTrigger>
          <TabsTrigger value="main" className={TAB_CLASS}>Основное</TabsTrigger>
        </TabsList>
        {isNew && (
          <p className="mb-4 text-base text-muted-foreground">
            Сначала сохраните вид заявки — после этого можно будет добавить поля.
          </p>
        )}
        <TabsContent value="main">
          <RequestTypeForm
            key={type?.id ?? "new"}
            type={type}
            allTypes={types}
            readOnly={readOnly}
            onCreated={(newId) =>
              navigate({ to: "/directories/request-types/$id", params: { id: newId }, replace: true })
            }
          />
        </TabsContent>
        {type && (
          <TabsContent value="fields">
            <RequestTypeFields typeId={type.id} readOnly={readOnly} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
