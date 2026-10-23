import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOverdueItems } from "@/components/overdue/data";

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

/** Окно «Просрочено» при входе (ТЗ 7.8): просроченные заявки и этапы по видимым объектам.
 *  Данные — те же, что в разделе «Просрочено» (правка 2.2). */
export function OverdueDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(readAck);
  const { items: all } = useOverdueItems();
  const items = all.map((it) => ({
    key: it.key,
    what: it.kind === "request" ? `${it.title} — не исполнена` : `${it.title} — срок прошёл`,
    objectName: it.objectName,
    days: it.days,
    open: () =>
      it.kind === "request"
        ? navigate({ to: "/requests/$requestId", params: { requestId: it.id } })
        : navigate({ to: "/objects/$id/stages/$stageId", params: { id: it.objectId, stageId: it.id } }),
  }));

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
            <thead className="sticky top-0 bg-card">
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-muted-foreground sm:mr-auto">
            Этот список всегда доступен в разделе «Просрочено» в меню слева.
          </p>
          <Button
            variant="outline"
            className="h-10 text-sm"
            onClick={() => {
              ack();
              navigate({ to: "/overdue" });
            }}
          >
            Открыть раздел
          </Button>
          <Button onClick={ack} className="h-10 text-sm sm:px-10">
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
