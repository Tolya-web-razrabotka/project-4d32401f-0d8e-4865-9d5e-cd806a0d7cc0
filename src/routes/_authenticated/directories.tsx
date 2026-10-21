import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { tabsListClass, tabTriggerClass } from "@/lib/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsDirectory } from "@/components/directories/DocumentsDirectory";
import { RepresentativesDirectory } from "@/components/directories/RepresentativesDirectory";
import { CustomersDirectory } from "@/components/directories/CustomersDirectory";
import { EmployeesDirectory } from "@/components/directories/EmployeesDirectory";
import { StatusesDirectory } from "@/components/directories/StatusesDirectory";
import { StagesDirectory } from "@/components/directories/stages/StagesDirectory";
import { RequestTypesDirectory } from "@/components/directories/request-types/RequestTypesDirectory";

const TABS = [
  { v: "stages", label: "Этапы" },
  { v: "documents", label: "Документы" },
  { v: "request-types", label: "Виды заявок" },
  { v: "representatives", label: "Представители" },
  { v: "customers", label: "Заказчики" },
  { v: "employees", label: "Сотрудники" },
  { v: "statuses", label: "Статусы этапа" },
] as const;

type TabValue = (typeof TABS)[number]["v"];

export const Route = createFileRoute("/_authenticated/directories")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabValue } => {
    const tab = TABS.find((t) => t.v === search["tab"])?.v;
    return tab ? { tab } : {};
  },
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


function DirectoriesPage() {
  const { tab = "stages" } = Route.useSearch();
  const navigate = useNavigate({ from: "/directories" });
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Справочники</h1>
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as TabValue }, replace: true })}>
        <TabsList className={tabsListClass}>
          {TABS.map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className={tabTriggerClass}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="stages"><StagesDirectory /></TabsContent>
        <TabsContent value="documents"><DocumentsDirectory /></TabsContent>
        <TabsContent value="request-types"><RequestTypesDirectory /></TabsContent>
        <TabsContent value="representatives"><RepresentativesDirectory /></TabsContent>
        <TabsContent value="customers"><CustomersDirectory /></TabsContent>
        <TabsContent value="employees"><EmployeesDirectory /></TabsContent>
        <TabsContent value="statuses"><StatusesDirectory /></TabsContent>
      </Tabs>
    </div>
  );
}
