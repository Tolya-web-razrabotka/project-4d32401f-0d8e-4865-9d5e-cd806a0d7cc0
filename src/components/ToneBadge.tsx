import type { ReactNode } from "react";

/**
 * Статус-бейдж в мягком тоне: светлая подложка, точка и затемнённый текст того же цвета.
 * Цвет приходит из справочника (stage_statuses.color) — админ по-прежнему его меняет.
 * color-mix поддерживается в Safari 16.2+ (iPad) и всех актуальных браузерах.
 */
export function ToneBadge({ color, children }: { color: string | null | undefined; children: ReactNode }) {
  const c = color || "#8A9099";
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in oklab, ${c} 13%, white)`,
        color: `color-mix(in oklab, ${c} 72%, black)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 22%, transparent)`,
      }}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
      {children}
    </span>
  );
}
