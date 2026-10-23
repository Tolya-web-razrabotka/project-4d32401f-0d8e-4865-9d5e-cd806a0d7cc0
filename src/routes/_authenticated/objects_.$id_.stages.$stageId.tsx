import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Flag } from "lucide-react";
import { tabsListClass, tabTriggerClass } from "@/lib/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryFeed } from "@/components/history/HistoryFeed";
import { StatusBadge, useRefreshStages, useStage } from "@/components/stages/data";
import { StageMainTab } from "@/components/stages/page/StageMainTab";
import { StageConditionsTab, useStageConditions } from "@/components/stages/page/StageConditionsTab";
import { StageDocumentsTab } from "@/components/stages/page/StageDocumentsTab";
import { StageStepsTab, useStageSteps } from "@/components/stages/page/StageStepsTab";
import { StageStatusBar } from "@/components/stages/page/StageStatusBar";

export const Route = createFileRoute("/_authenticated/objects_/$id_/stages/$stageId")({
  component: StagePage,
  head: () => ({ meta: [{ title: "Этап — Лидер" }] }),
});


function StagePage() {
  const { id, stageId } = Route.useParams();
  const qc = useQueryClient();
  const refreshStages = useRefreshStages();
  const { data: stage, isLoading } = useStage(stageId);
  const { data: conditions = [] } = useStageConditions(stageId);
  const { data: steps = [] } = useStageSteps(stageId);

  const refresh = () => {
    refreshStages(id, stageId);
    qc.invalidateQueries({ queryKey: ["stage-predecessors", stageId] });
  };

  const back = (
    <Link
      to="/objects/$id"
      params={{ id }}
      search={{ tab: "stages" }}
      className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <ArrowLeft className="size-4" /> К объекту
    </Link>
  );

  if (isLoading) return <div className="text-base text-muted-foreground">Загрузка…</div>;
  if (!stage || stage.object_id !== id) {
    return (
      <div>
        {back}
        <p className="py-10 text-base text-muted-foreground">Этап не найден или у вас нет к нему доступа</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {back}
      {/* Правка 2.15: на широком экране справа закреплены действия со статусом этапа */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="min-w-0">
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start gap-4">
          <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight">
            <span className="text-muted-foreground">{stage.number}.</span> {stage.name}
          </h1>
          <StatusBadge name={stage.status_name} color={stage.status_color} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {stage.work_type_name && <span>{stage.work_type_name}</span>}
          {stage.is_critical && (
            <span className="inline-flex items-center gap-1 font-medium text-destructive">
              <Flag className="size-3.5 fill-destructive" /> критичный
            </span>
          )}
          {stage.out_of_order && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
              <AlertTriangle className="size-3.5" /> взят вне очереди
            </span>
          )}
          {stage.current_step_action && <span>Сейчас: {stage.current_step_action}</span>}
        </div>
      </div>

      <Tabs key={stageId} defaultValue="main">
        <TabsList className={tabsListClass}>
          <TabsTrigger value="main" className={tabTriggerClass}>Основное</TabsTrigger>
          <TabsTrigger value="conditions" className={tabTriggerClass}>
            Условия закрытия
            {stage.conditions_total > 0 && (
              <span className="ml-1.5 rounded bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {stage.conditions_done}/{stage.conditions_total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className={tabTriggerClass}>Документы</TabsTrigger>
          {steps.length > 0 && <TabsTrigger value="steps" className={tabTriggerClass}>Сценарий</TabsTrigger>}
          <TabsTrigger value="history" className={tabTriggerClass}>История</TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <StageMainTab key={stage.id + stage.updated_at} stage={stage} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="conditions">
          <StageConditionsTab stage={stage} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="documents">
          <StageDocumentsTab stage={stage} />
        </TabsContent>
        {steps.length > 0 && (
          <TabsContent value="steps">
            <StageStepsTab steps={steps} disabled={stage.is_excluded || stage.is_closed} onChanged={refresh} />
          </TabsContent>
        )}
        <TabsContent value="history">
          <HistoryFeed filter={{ entityType: "stage", entityId: stage.id }} />
        </TabsContent>
      </Tabs>

      <div className="xl:hidden">
        <StageStatusBar stage={stage} conditions={conditions} onChanged={refresh} />
      </div>
      </div>
      <aside className="hidden xl:sticky xl:top-6 xl:block [&>div]:mt-0">
        <StageStatusBar stage={stage} conditions={conditions} onChanged={refresh} />
      </aside>
      </div>
    </div>
  );
}
