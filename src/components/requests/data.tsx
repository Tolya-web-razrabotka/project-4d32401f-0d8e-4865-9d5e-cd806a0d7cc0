import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { daysBetween, mskToday } from "@/lib/dates";
import { OBJECTS_KEY } from "@/components/objects/data";

export type RequestStatus = "new" | "ready" | "sent" | "accepted" | "done";

export const REQUEST_STATUSES: { v: RequestStatus; label: string; next: string; color: string }[] = [
  { v: "new", label: "Новая", next: "", color: "#DC2626" },
  { v: "ready", label: "Готова к отправке", next: "Готова к отправке", color: "#D97706" },
  { v: "sent", label: "Отправлена", next: "Отправлена", color: "#7C3AED" },
  { v: "accepted", label: "Принята заказчиком", next: "Принята заказчиком", color: "#2563EB" },
  { v: "done", label: "Исполнена", next: "Исполнено", color: "#16A34A" },
];

export const statusInfo = (s: string) => REQUEST_STATUSES.find((x) => x.v === s) ?? REQUEST_STATUSES[0]!;

export type RequestRow = {
  id: string;
  number: number;
  object_id: string;
  object_name: string;
  request_type_id: string;
  type_name: string;
  representative_id: string | null;
  representative_name: string | null;
  stage_id: string | null;
  initiator_id: string | null;
  initiator_name: string | null;
  office_id: string | null;
  office_name: string | null;
  call_date: string;
  status: RequestStatus;
  sent_at: string | null;
  accepted_at: string | null;
  done_at: string | null;
  done_by: string | null;
  result_text: string | null;
  created_at: string;
  is_new: boolean;
  is_overdue: boolean;
};

export type FieldValue = {
  request_id: string;
  field_id: string;
  label: string;
  field_type: string;
  value: unknown;
};

export const requestsKey = ["requests"] as const;

/** Порядок по ТЗ 7.7: новые, затем просроченные, затем остальные по дате вызова (свежие выше). */
export function sortRequests(rows: RequestRow[]) {
  const rank = (r: RequestRow) => (r.is_new ? 0 : r.is_overdue ? 1 : 2);
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || b.call_date.localeCompare(a.call_date) || b.number - a.number,
  );
}

export function useRequests(objectId?: string) {
  return useQuery({
    queryKey: [...requestsKey, objectId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("v_requests").select("*").order("call_date", { ascending: false }).limit(2000);
      if (objectId) q = q.eq("object_id", objectId);
      const { data, error } = await q;
      if (error) throw error;
      return sortRequests(
        (data ?? []).map((r) => ({ ...(r as unknown as RequestRow), is_new: !!r.is_new, is_overdue: !!r.is_overdue })),
      );
    },
  });
}

/** Значения полей для списка заявок (ключевые поля и поиск по номеру протокола и т. п.). */
export function useFieldValues(requestIds: string[], scope: string) {
  return useQuery({
    queryKey: [...requestsKey, "values", scope, requestIds.length],
    enabled: requestIds.length > 0,
    queryFn: async () => {
      const out: FieldValue[] = [];
      // Ограничение длины URL: запрашиваем пачками
      for (let i = 0; i < requestIds.length; i += 150) {
        const { data, error } = await supabase
          .from("request_field_values")
          .select("request_id, field_id, label, field_type, value")
          .in("request_id", requestIds.slice(i, i + 150));
        if (error) throw error;
        out.push(...((data ?? []) as FieldValue[]));
      }
      return out;
    },
  });
}

export function formatValue(fieldType: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (fieldType === "checkbox") return value === true ? "Да" : "Нет";
  if (fieldType === "date" && typeof value === "string") return formatDate(value);
  return String(value);
}

export function overdueDays(r: RequestRow) {
  return r.is_overdue ? daysBetween(r.call_date, mskToday()) : 0;
}

export function RequestStatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-base font-medium text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.v === "done" ? "✓ " : ""}
      {s.label}
    </span>
  );
}

/** Сбросить всё, что зависит от заявок: списки, счётчики меню и кнопок, сводку объектов, историю. */
export function useRefreshRequests() {
  const qc = useQueryClient();
  return (requestId?: string) => {
    qc.invalidateQueries({ queryKey: requestsKey });
    qc.invalidateQueries({ queryKey: ["requests-attention-count"] });
    qc.invalidateQueries({ queryKey: ["object-request-counts"] });
    qc.invalidateQueries({ queryKey: OBJECTS_KEY });
    qc.invalidateQueries({ queryKey: ["history"] });
    if (requestId) qc.invalidateQueries({ queryKey: ["request", requestId] });
  };
}

export function useRepresentatives() {
  return useQuery({
    queryKey: ["representatives-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort");
      if (error) throw error;
      return data ?? [];
    },
  });
}
