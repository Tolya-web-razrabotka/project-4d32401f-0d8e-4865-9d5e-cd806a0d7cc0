import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { showError } from "@/lib/format";

export function Toolbar({
  search,
  onSearch,
  onAdd,
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  onAdd?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск"
          className="h-12 pl-11 text-lg"
        />
      </div>
      {children}
      {onAdd && (
        <Button onClick={onAdd} className="h-12 px-6 text-lg">
          <Plus className="size-5" /> Добавить
        </Button>
      )}
    </div>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-base">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function EditSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-2xl">{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function matches(search: string, ...values: (string | null | undefined)[]) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => v?.toLowerCase().includes(q));
}

export function emptyToNull(v: string) {
  const t = v.trim();
  return t === "" ? null : t;
}

type SoftTable = "documents" | "representatives" | "customers" | "customer_contacts" | "profiles";

/** Мягкое удаление с подтверждением. */
export function DeleteButton({
  table,
  id,
  name,
  invalidate,
  onDone,
}: {
  table: SoftTable;
  id: string;
  name: string;
  invalidate: string[];
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: invalidate });
      setOpen(false);
      onDone?.();
    },
    onError: showError,
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-11 text-base text-destructive">
        <Trash2 className="size-5" /> Удалить
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">«{name}» будет удалена.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 text-base">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-base text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                m.mutate();
              }}
              disabled={m.isPending}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function FormActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <Button type="submit" disabled={pending} className="h-12 flex-1 text-lg">
        {pending ? "Сохранение…" : "Сохранить"}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} className="h-12 flex-1 text-lg">
        Отмена
      </Button>
    </div>
  );
}

export function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8 text-center text-lg text-muted-foreground">
        Ничего не найдено
      </td>
    </tr>
  );
}
