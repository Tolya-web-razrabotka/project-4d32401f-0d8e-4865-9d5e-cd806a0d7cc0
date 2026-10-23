import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RequestField } from "@/components/directories/request-types/data";
import { formatPickets, parsePickets, picketLength, type Picket, type PicketRange } from "@/lib/pickets";

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
    case "textarea":
      return (
        <Textarea
          disabled={disabled}
          rows={3}
          value={typeof value === "string" ? value : value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 text-sm"
        />
      );
    case "picket_range":
      return <PicketRangeInput value={value} onChange={onChange} disabled={disabled} />;
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

/**
 * «Пикеты (от – до)» (правка 2.10): от ПК [ ] + [ ] м — до ПК [ ] + [ ] м, ниже — длина участка.
 * Наружу отдаёт строку «ПК 3+20 – ПК 4+60» (null, пока «от» не заполнено).
 * Старое значение, которое не удаётся разобрать, показывается текстом, чтобы его не потерять.
 */
function PicketRangeInput({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const parsed = parsePickets(value);
  const [r, setR] = useState<PicketRange>(parsed ?? { from: { pk: "", m: "" }, to: { pk: "", m: "" } });
  const legacy = parsed === null && typeof value === "string" ? value : null;
  // Значение могло прийти снаружи позже (карточка заявки загрузилась) — подхватываем, если это не наш собственный ввод
  const emitted = useRef<unknown>(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setR(parsePickets(value) ?? { from: { pk: "", m: "" }, to: { pk: "", m: "" } });
  }, [value]);

  const update = (side: "from" | "to", part: keyof Picket, raw: string) => {
    const clean = part === "pk" ? raw.replace(/\D/g, "").slice(0, 4) : raw.replace(",", ".").replace(/[^\d.]/g, "").slice(0, 5);
    const next = { ...r, [side]: { ...r[side], [part]: clean } };
    setR(next);
    emitted.current = formatPickets(next);
    onChange(emitted.current);
  };
  const len = picketLength(r);

  const box = (side: "from" | "to", label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="w-5 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">ПК</span>
      <Input
        inputMode="numeric"
        disabled={disabled}
        value={r[side].pk}
        onChange={(e) => update(side, "pk", e.target.value)}
        placeholder="0"
        aria-label={`${label}: номер пикета`}
        className="h-9 w-16 text-center text-sm tabular-nums"
      />
      <span className="text-sm font-medium">+</span>
      <Input
        inputMode="decimal"
        disabled={disabled}
        value={r[side].m}
        onChange={(e) => update(side, "m", e.target.value)}
        placeholder="00"
        aria-label={`${label}: метры`}
        className="h-9 w-16 text-center text-sm tabular-nums"
      />
      <span className="text-xs text-muted-foreground">м</span>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {box("from", "от")}
        <span className="hidden text-muted-foreground sm:inline">—</span>
        {box("to", "до")}
      </div>
      {len !== null && (
        <p className={`text-xs ${len < 0 ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}`}>
          {len < 0 ? `«до» меньше «от» на ${Math.abs(len)} м — проверьте пикеты` : `Участок ${len} м`}
        </p>
      )}
      {!r.to.pk && r.from.pk && (
        <p className="text-xs text-muted-foreground">Если нужна одна точка, «до» можно не заполнять</p>
      )}
      {legacy && <p className="text-xs text-muted-foreground">Было записано: «{legacy}»</p>}
    </div>
  );
}
