import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditSheet, EmptyRow, Field, FormActions, Toolbar, matches } from "./common";

const KEY = ["dir-stage-statuses"];
type St = { code: string; name: string; color: string; sort: number };

export function StatusBadge({ name, color }: { name: string; color: string }) {
  // Цвет статуса хранится в базе, поэтому задаётся inline.
  return (
    <span className="inline-block rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: color, color: textOn(color) }}>
      {name}
    </span>
  );
}

function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "inherit";
  const n = parseInt(m[1]!, 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#000" : "#fff";
}

export function StatusesDirectory() {
  const { is_admin } = useProfile();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<St | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("stage_statuses").select("code, name, color, sort").order("sort");
      if (error) throw error;
      return data as St[];
    },
  });
  const rows = data.filter((s) => matches(search, s.name));
  return (
    <div>
      <Toolbar search={search} onSearch={setSearch} />
      <div className="rounded-md border bg-card">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Цвет</TableHead>
              <TableHead>Порядок</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? null : rows.length === 0 ? (
              <EmptyRow cols={3} />
            ) : (
              rows.map((s) => (
                <TableRow key={s.code} className={is_admin ? "cursor-pointer" : ""} onClick={() => is_admin && setEditing(s)}>
                  <TableCell><StatusBadge name={s.name} color={s.color} /></TableCell>
                  <TableCell className="font-mono">{s.color}</TableCell>
                  <TableCell>{s.sort}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <EditSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Статус этапа">
        {editing && <StForm key={editing.code} st={editing} onClose={() => setEditing(null)} />}
      </EditSheet>
    </div>
  );
}

function StForm({ st, onClose }: { st: St; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(st.name);
  const [color, setColor] = useState(st.color);
  const [sort, setSort] = useState(String(st.sort));
  const validHex = /^#[0-9a-f]{6}$/i.test(color);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stage_statuses")
        .update({ name: name.trim(), color, sort: Number(sort) })
        .eq("code", st.code);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
    onError: showError,
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) { toast.error("Заполните название"); return; }
        if (!validHex) { toast.error("Цвет должен быть в формате #RRGGBB"); return; }
        if (!Number.isInteger(Number(sort))) { toast.error("Порядок должен быть целым числом"); return; }
        m.mutate();
      }}
    >
      <Field label="Название" required><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" /></Field>
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
      <Field label="Порядок"><Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 w-40 text-sm" /></Field>
      <div>Пример: <StatusBadge name={name || "—"} color={validHex ? color : st.color} /></div>
      <FormActions pending={m.isPending} onCancel={onClose} />
    </form>
  );
}
