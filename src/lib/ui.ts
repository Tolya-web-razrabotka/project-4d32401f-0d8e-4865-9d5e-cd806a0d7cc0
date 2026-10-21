/**
 * Общие классы оформления. Вкладки — сегментный переключатель:
 * серая подложка, активная вкладка — белая «плашка».
 */
export const tabsListClass =
  "mb-4 inline-flex h-auto max-w-full flex-wrap justify-start gap-0.5 rounded-lg bg-muted p-1";

export const tabTriggerClass =
  "h-8 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground " +
  "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm " +
  "disabled:opacity-40";
