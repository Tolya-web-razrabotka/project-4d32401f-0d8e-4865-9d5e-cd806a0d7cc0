import { Checkbox } from "@/components/ui/checkbox";
import { MEMBER_ROLES, useActiveProfiles } from "./data";

/** Выбор участников объекта по ролям, несколько человек на роль (ТЗ 7.3, шаг 2). */
export function MembersPicker({
  value,
  onToggle,
  disabled,
}: {
  value: string[];
  onToggle: (profileId: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const { data: profiles = [], isLoading } = useActiveProfiles();
  if (isLoading) return null;
  const known = new Set<string>(MEMBER_ROLES.map((r) => r.code));
  const others = profiles.filter((p) => !known.has(p.role_code));

  const group = (title: string, people: typeof profiles) => (
    <div key={title} className="rounded-lg border p-4">
      <div className="mb-3 text-lg font-semibold">{title}</div>
      {people.length === 0 ? (
        <p className="text-base text-muted-foreground">Нет сотрудников с этой ролью — добавьте в «Справочники → Сотрудники»</p>
      ) : (
        <div className="space-y-3">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-3 text-lg">
              <Checkbox
                className="size-6"
                checked={value.includes(p.id)}
                disabled={disabled}
                onCheckedChange={(c) => onToggle(p.id, c === true)}
              />
              {p.full_name}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid max-w-5xl gap-4 md:grid-cols-2">
      {MEMBER_ROLES.map((r) => group(r.label, profiles.filter((p) => p.role_code === r.code)))}
      {others.length > 0 && group("Другие", others)}
    </div>
  );
}
