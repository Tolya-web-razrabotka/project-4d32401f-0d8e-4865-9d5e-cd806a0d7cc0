import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, mskToday } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useObjects } from "@/components/objects/data";

/** Флаг «Понятно» живёт до следующего входа (sessionStorage), при выходе сбрасывается. */
export const OVERDUE_ACK_KEY = "lider-overdue-ack";

function readAck() {
  try {
    return sessionStorage.getItem(OVERDUE_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearOverdueAck() {
  try {
    sessionStorage.removeItem(OVERDUE_ACK_KEY);
  } catch {
    /* хранилище недоступно — окно просто покажется снова */
  }
}

type Item = { key: string; what: string; objectName: string; days: number; open: () => void };

/** Окно «Просрочено» при входе (ТЗ 7.8): просроченные заявки и этапы по видимым объектам. */
export function OverdueDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(readAck);
  const { data: objects = [] } = useObjects();

  const { data } = useQuery({
    queryKey: ["overdue-on-login"],
    enabled: !acked,
    queryFn: async () => {
      const [req, st] = await Promise.all([
        supabase.from("v_requests").select("id, number, type_name, object_id, call_date").eq("is_overdue", true),
        supabase
          .from("v_object_stages")
          .select("id, number, name, object_id, due_date")
          .eq("is_overdue", true)
          .eq("is_excluded", false),
      ]);
      if (req.error) throw req.error;
      if (st.error) throw st.error;
      return { requests: req.data ?? [], stages: st.data ?? [] };
    },
  });

  const activeObjects = new Map(objects.filter((o) => o.status !== "completed").map((o) => [o.id, o.name]));
  const today = mskToday();
  const items: Item[] = data
    ? [
        ...data.requests
          .filter((r) => activeObjects.has(r.object_id!))
          .map((r) => ({
            key: `r-${r.id}`,
            what: `Заявка №${r.number} «${r.type_name}» — не исполнена`,
            objectName: activeObjects.get(r.object_id!) ?? "",
            days: daysBetween(r.call_date!, today),
            open: () => navigate({ to: "/requests/$requestId", params: { requestId: r.id! } }),
          })),
        ...data.stages
          .filter((s) => activeObjects.has(s.object_id!))
          .map((s) => ({
            key: `s-${s.id}`,
            what: `Этап ${s.number} «${s.name}» — срок прошёл`,
            objectName: activeObjects.get(s.object_id!) ?? "",
            days: daysBetween(s.due_date!, today),
            open: () => navigate({ to: "/objects/$id/stages/$stageId", params: { id: s.object_id!, stageId: s.id! } }),
          })),
      ].sort((a, b) => b.days - a.days)
    : [];

  useEffect(() => {
    if (!acked && items.length > 0) setOpen(true);
  }, [acked, items.length]);

  const ack = () => {
    try {
      sessionStorage.setItem(OVERDUE_ACK_KEY, "1");
    } catch {
      /* без хранилища окно покажется при следующем открытии вкладки */
    }
    setAcked(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? ack() : setOpen(true))}>
      <DialogContent className="flex h-[95vh] max-w-[95vw] flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl text-red-700 dark:text-red-300">
            <AlertTriangle className="size-6" /> Просрочено: {items.length}
          </DialogTitle>
          <DialogDescription className="text-sm">Эти заявки и этапы требуют внимания.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Что</th>
                <th className="px-4 py-2 font-semibold">Объект</th>
                <th className="px-4 py-2 font-semibold">Просрочено</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} className="border-t bg-red-50/60 dark:bg-red-950/30">
                  <td className="px-4 py-2 font-medium">{it.what}</td>
                  <td className="px-4 py-2">{it.objectName}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-bold text-red-700 dark:text-red-300">{it.days} дн.</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      className="h-9 text-sm"
                      onClick={() => {
                        ack();
                        it.open();
                      }}
                    >
                      Открыть
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={ack} className="h-10 w-full text-base sm:w-auto sm:self-end sm:px-10">
          Понятно
        </Button>
      </DialogContent>
    </Dialog>
  );
}
