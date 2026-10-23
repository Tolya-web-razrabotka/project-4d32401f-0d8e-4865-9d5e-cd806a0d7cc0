import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/directories/common";
import { CustomerForm } from "@/components/directories/CustomerForm";
import { OBJECT_STATUSES, useActiveProfiles, useCustomersShort, useObjectTypes } from "./data";

export type ObjectDraft = {
  name: string;
  address: string;
  customer_id: string;
  object_type: string;
  contract_start: string;
  contract_end: string;
  responsible_id: string;
  status: "planned" | "in_work" | "completed";
  notes: string;
};

export const EMPTY_DRAFT: ObjectDraft = {
  name: "",
  address: "",
  customer_id: "",
  object_type: "", // первый тип из справочника подставляется при открытии формы
  contract_start: "",
  contract_end: "",
  responsible_id: "",
  status: "in_work",
  notes: "",
};

const NONE = "__none";

/** Проверка обязательных полей карточки (ТЗ 7.3, шаг 1). Возвращает текст ошибки или null. */
export function validateDraft(d: ObjectDraft): string | null {
  if (!d.name.trim()) return "Укажите название договора объекта";
  if (!d.customer_id) return "Выберите заказчика";
  if (!d.object_type) return "Выберите тип объекта";
  if (!d.contract_start || !d.contract_end) return "Укажите даты начала и окончания по договору";
  if (d.contract_end < d.contract_start) return "Дата окончания раньше даты начала";
  return null;
}

/** Данные карточки в формате create_object / update objects. */
export function draftToPayload(d: ObjectDraft) {
  const t = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    name: d.name.trim(),
    address: t(d.address),
    customer_id: d.customer_id || null,
    object_type: d.object_type,
    contract_start: d.contract_start || null,
    contract_end: d.contract_end || null,
    responsible_id: d.responsible_id || null,
    status: d.status,
    notes: t(d.notes),
  };
}

export function ObjectCardFields({
  value,
  onChange,
  showStatus,
}: {
  value: ObjectDraft;
  onChange: (v: ObjectDraft) => void;
  showStatus?: boolean;
}) {
  const { data: customers = [] } = useCustomersShort();
  const { data: profiles = [] } = useActiveProfiles();
  const [addCustomer, setAddCustomer] = useState(false);
  const set = <K extends keyof ObjectDraft>(k: K, v: ObjectDraft[K]) => onChange({ ...value, [k]: v });

  // Типы объектов из справочника; у редактируемого объекта оставляем его тип, даже если тип удалили
  const { all: objectTypes, active: activeTypes } = useObjectTypes();
  const typeChoices = objectTypes.filter((t) => !t.deleted_at || t.code === value.object_type);
  const firstType = activeTypes[0]?.code;
  useEffect(() => {
    if (!value.object_type && firstType) onChange({ ...value, object_type: firstType });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только когда справочник загрузился
  }, [firstType]);

  return (
    <div className="max-w-3xl space-y-5">
      <Field label="Название договора объекта" required>
        <Input value={value.name} onChange={(e) => set("name", e.target.value)} className="h-9 text-sm" />
      </Field>
      <Field label="Адрес">
        <Input value={value.address} onChange={(e) => set("address", e.target.value)} className="h-9 text-sm" />
      </Field>
      <Field label="Заказчик" required>
        <div className="flex flex-wrap gap-3">
          <Select value={value.customer_id} onValueChange={(v) => set("customer_id", v)}>
            <SelectTrigger className="h-9 min-w-64 flex-1 text-sm">
              <SelectValue placeholder="Выберите заказчика" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => setAddCustomer(true)} className="h-9 text-sm">
            <Plus className="size-4" /> Добавить заказчика
          </Button>
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Тип объекта">
          <Select value={value.object_type} onValueChange={(v) => set("object_type", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
            <SelectContent>
              {typeChoices.map((t) => (
                <SelectItem key={t.code} value={t.code} className="text-sm">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Список настраивается в Справочниках, вкладка «Типы объектов».</p>
        </Field>
        <Field label="Ответственный">
          <Select value={value.responsible_id || NONE} onValueChange={(v) => set("responsible_id", v === NONE ? "" : v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} className="text-sm">Не выбран</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-sm">{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Дата начала по договору" required>
          <Input
            type="date"
            value={value.contract_start}
            onChange={(e) => set("contract_start", e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Дата окончания по договору" required>
          <Input
            type="date"
            value={value.contract_end}
            min={value.contract_start || undefined}
            onChange={(e) => set("contract_end", e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        {showStatus && (
          <Field label="Статус объекта">
            <Select value={value.status} onValueChange={(v) => set("status", v as ObjectDraft["status"])}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECT_STATUSES.map((t) => (
                  <SelectItem key={t.v} value={t.v} className="text-sm">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <Field label="Примечание">
        <Textarea value={value.notes} onChange={(e) => set("notes", e.target.value)} className="text-sm" />
      </Field>

      <Dialog open={addCustomer} onOpenChange={setAddCustomer}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Новый заказчик</DialogTitle>
          </DialogHeader>
          <CustomerForm
            onSaved={(c) => {
              set("customer_id", c.id);
              setAddCustomer(false);
            }}
            onCancel={() => setAddCustomer(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
