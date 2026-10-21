import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Список с изменением порядка: перетаскивание за ручку (мышь) и стрелки ↑↓ (планшет, клавиатура).
 * onMove получает новый порядок id; сохранение — на стороне вызывающего.
 */
export function Reorderable<T extends { id: string }>({
  items,
  disabled,
  onMove,
  render,
}: {
  items: T[];
  disabled?: boolean;
  onMove: (orderedIds: string[]) => void;
  render: (item: T, index: number) => ReactNode;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(from, 1);
    if (moved === undefined) return;
    ids.splice(to, 0, moved);
    onMove(ids);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          onDragOver={(e) => {
            if (disabled || !dragId) return;
            e.preventDefault();
            if (overId !== item.id) setOverId(item.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (disabled || !dragId) return;
            const from = items.findIndex((i) => i.id === dragId);
            move(from, index);
            setDragId(null);
            setOverId(null);
          }}
          className={`flex items-start gap-2 rounded-md border bg-card p-3 transition-colors ${
            dragId === item.id ? "opacity-50" : ""
          } ${overId === item.id && dragId !== item.id ? "border-primary bg-accent" : ""}`}
        >
          {!disabled && (
            <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
              <span
                draggable
                onDragStart={(e) => {
                  setDragId(item.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", item.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                title="Перетащите, чтобы изменить порядок"
                className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                aria-label="Выше"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label="Ниже"
              >
                <ArrowDown className="size-4" />
              </Button>
            </div>
          )}
          <div className="min-w-0 flex-1">{render(item, index)}</div>
        </div>
      ))}
    </div>
  );
}
