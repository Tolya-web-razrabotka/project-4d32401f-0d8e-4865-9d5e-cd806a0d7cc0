import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsDirectory } from "@/components/directories/DocumentsDirectory";
import { RepresentativesDirectory } from "@/components/directories/RepresentativesDirectory";
import { CustomersDirectory } from "@/components/directories/CustomersDirectory";
import { EmployeesDirectory } from "@/components/directories/EmployeesDirectory";
import { StatusesDirectory } from "@/components/directories/StatusesDirectory";

const TABS = [
  { v: "stages", label: "Этапы" },
  { v: "documents", label: "Документы" },
  { v: "request-types", label: "Виды заявок" },
  { v: "representatives", label: "Представители" },
  { v: "customers", label: "Заказчики" },
  { v: "employees", label: "Сотрудники" },
  { v: "statuses", label: "Статусы этапа" },
] as const;

export const Route = createFileRoute("/_authenticated/directories")({
  component: DirectoriesPage,
  head: () => ({
    meta: [
      { title: "Справочники — Лидер" },
      { name: "description", content: "Справочники в системе «Лидер»" },
      { property: "og:title", content: "Справочники — Лидер" },
      { property: "og:description", content: "Справочники в системе «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Stub() {
  return <p className="py-10 text-center text-xl text-muted-foreground">Раздел в разработке</p>;
}

function DirectoriesPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Справочники</h1>
      <Tabs defaultValue="documents">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="h-12 border px-5 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="stages"><Stub /></TabsContent>
        <TabsContent value="documents"><DocumentsDirectory /></TabsContent>
        <TabsContent value="request-types"><Stub /></TabsContent>
        <TabsContent value="representatives"><RepresentativesDirectory /></TabsContent>
        <TabsContent value="customers"><CustomersDirectory /></TabsContent>
        <TabsContent value="employees"><EmployeesDirectory /></TabsContent>
        <TabsContent value="statuses"><StatusesDirectory /></TabsContent>
      </Tabs>
    </div>
  );
}
