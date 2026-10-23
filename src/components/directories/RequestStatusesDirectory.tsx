import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ToneBadge";
import { REQUEST_STATUSES_KEY, useRequestStatuses, type RequestStatusDef } from "@/components/requests/data";
import { EditSheet, Field, FormActions } from "./common";

/**
 * Справочник «Статусы заявки» (правка 2.14, db/10) — шаги «Хода заявки».
 * Как «Статусы этапа»: шаги и их порядок фиксированы, меняются название, текст кнопки и цвет.
 */
export function RequestStatusesDirectory() {
  const { is_admin } = useProfile();
  const statuses = useRequestStatuses();
  const [editing, setEditing] = useState<{ s: RequestStatusDef; i: number } | null>(null);

  return (
    <div className="max-w-4xl">
      <p className="mb-4 text-sm text-muted-foreground">
        Шаги «Хода заявки» в карточке заявки. Порядок шагов и правила переходов постоянные: заявка проходит их по очереди,
        перед «{statuses[1]?.label}» проверяются обязательные поля, после последнего шага заявка считается исполненной.
        Название шага, текст кнопки и цвет можно поменять.
      </p>

      {/* Сама цепочка — как её видит пользователь */}
      <ol className="mb-5 flex flex-wrap items-center gap-2">
        {statuses.map((s, i) => (
          <li key={s.v} className="flex items-center gap-2">
            <ToneBadge color={s.color}>
              {i + 1}. {s.label}
            </ToneBadge>
            {i < statuses.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-10 px-4 py-2 font-semibold">№</th>
              <th className="px-4 py-2 font-semibold">Шаг</th>
              <th className="px-4 py-2 font-semibold">Кнопка перехода на шаг</th>
              <th className="px-4 py-2 font-semibold">Цвет</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s, i) => (
              <tr
                key={s.v}
                onClick={() => is_admin && setEditing({ s, i })}
                className={`border-t ${is_admin ? "cursor-pointer hover:bg-muted/40" : ""}`}
              >
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2"><ToneBadge color={s.color}>{s.label}</ToneBadge></td>
                <td className="px-4 py-2">{i === 0 ? <span className="text-muted-foreground">создаётся сразу</span> : `«${s.next}»`}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.color}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Шаг ${editing ? editing.i + 1 : ""}`}>
        {editing && <StatusForm key={editing.s.v} s={editing.s} first={editing.i === 0} onClose={() => setEditing(null)} />}
      </EditSheet>
    </div>
  );
}

function StatusForm({ s, first, onClose }: { s: RequestStatusDef; first: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(s.label);
  const [action, setAction] = useState(s.next);
  const [color, setColor] = useState(s.color);
  const validHex = /^#[0-9a-f]{6}$/i.test(color);

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("request_statuses")
        .update({ name: name.trim(), action_label: first ? "" : action.trim(), color })
        .eq("code", s.v)
        .select("code");
      if (error) throw error;
      if (!data?.length) throw new Error("Справочник статусов заявки не найден в базе — выполните db/10_request_statuses.sql");
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: REQUEST_STATUSES_KEY });
      onClose();
    },
    onError: showError,
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) { toast.error("Заполните название шага"); return; }
        if (!first && !action.trim()) { toast.error("Заполните текст кнопки"); return; }
        if (!validHex) { toast.error("Цвет должен быть в формате #RRGGBB"); return; }
        m.mutate();
      }}
    >
      <Field label="Название шага" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
      </Field>
      {!first && (
        <Field label="Текст кнопки перехода на этот шаг" required>
          <Input value={action} onChange={(e) => setAction(e.target.value)} className="h-9 text-sm" />
        </Field>
      )}
      <Field label="Цвет">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={validHex ? color : "#000000"}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded border"
            aria-label="Выбор цвета"
          />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-40 font-mono text-sm" />
        </div>
      </Field>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        Пример: <ToneBadge color={validHex ? color : s.color}>{name || s.label}</ToneBadge>
        {!first && (
          <Button type="button" className="pointer-events-none h-9 px-4 text-sm">
            {action || s.next}
          </Button>
        )}
      </div>
      <FormActions pending={m.isPending} onCancel={onClose} />
    </form>
  );
}
