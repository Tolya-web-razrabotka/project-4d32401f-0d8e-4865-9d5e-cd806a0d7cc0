import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { TONE_CLASS, contractTone, daysLeftText, statusLabel, typeLabel, type ObjectRow } from "./data";

/** Шапка объекта (ТЗ 7.4): название, адрес, заказчик, срок по договору с подсветкой. */
export function ObjectHeader({ o, actions }: { o: ObjectRow; actions?: ReactNode }) {
  const tone = o.status === "completed" ? "none" : contractTone(o.contract_days_left);
  return (
    <div className="mb-6 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold leading-tight">{o.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-lg text-muted-foreground">
            {o.address && <span>{o.address}</span>}
            {o.customer_name && <span>Заказчик: {o.customer_name}</span>}
            <span>{typeLabel(o.object_type)}</span>
            {o.responsible_name && <span>Ответственный: {o.responsible_name}</span>}
            {o.status !== "in_work" && <span className="font-medium">{statusLabel(o.status)}</span>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <div className={`mt-4 inline-flex flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-lg ${TONE_CLASS[tone] || "bg-muted"}`}>
        <span className="font-medium">Срок по договору:</span>
        <span>
          {formatDate(o.contract_start) || "—"} — {formatDate(o.contract_end) || "—"}
        </span>
        {o.status !== "completed" && o.contract_days_left !== null && (
          <span className="font-semibold">· {daysLeftText(o.contract_days_left)}</span>
        )}
      </div>
      {o.notes && <p className="mt-3 whitespace-pre-line text-base text-muted-foreground">{o.notes}</p>}
    </div>
  );
}
