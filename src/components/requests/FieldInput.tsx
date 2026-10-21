import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RequestField } from "@/components/directories/request-types/data";

const EMPTY = "__empty";

/** Значение поля в форме: строка, число, дата ISO, bool. Файлы загружаются отдельно. */
export function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RequestField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const cls = "h-9 text-sm";
  switch (field.field_type) {
    case "number":
      return (
        <Input
          type="number"
          inputMode="decimal"
          disabled={disabled}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={cls}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={cls}
        />
      );
    case "select":
      return (
        <Select
          value={typeof value === "string" && value ? value : EMPTY}
          onValueChange={(v) => onChange(v === EMPTY ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className={cls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY} className="text-sm">Не выбрано</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "checkbox":
      return (
        <label className="flex h-9 items-center gap-3 text-sm">
          <Checkbox className="size-4" disabled={disabled} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
          Да
        </label>
      );
    default:
      return (
        <Input
          disabled={disabled}
          value={typeof value === "string" ? value : value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      );
  }
}

/** Пустое ли значение (как в проверках request_create / request_set_status). */
export function isEmptyValue(v: unknown) {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}
