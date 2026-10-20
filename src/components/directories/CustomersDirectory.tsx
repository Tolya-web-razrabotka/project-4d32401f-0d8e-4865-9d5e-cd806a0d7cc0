import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteButton, EditSheet, EmptyRow, Field, FormActions, Toolbar, emptyToNull, matches } from "./common";
import { CustomerForm, CUSTOMERS_KEY, type Customer } from "./CustomerForm";

export function CustomersDirectory() {
  const { is_admin } = useProfile();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, inn, kpp, ogrn, legal_address, comment")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
  const rows = data.filter((c) => matches(search, c.name, c.inn, c.legal_address, c.comment));
  const current = data.find((c) => c.id === openId) ?? null;
  return (
    <div>
      <Toolbar search={search} onSearch={setSearch} onAdd={is_admin ? () => setCreating(true) : undefined} />
      <div className="rounded-lg border">
        <Table className="text-base">
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? null : rows.length === 0 ? (
              <EmptyRow cols={4} />
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.inn}</TableCell>
                  <TableCell>{c.legal_address}</TableCell>
                  <TableCell className="text-muted-foreground">{c.comment}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <EditSheet open={creating} onOpenChange={setCreating} title="Новый заказчик">
        {creating && (
          <CustomerForm
            onSaved={(c) => {
              setCreating(false);
              setOpenId(c.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
      </EditSheet>
      <EditSheet open={!!current} onOpenChange={(o) => !o && setOpenId(null)} title="Заказчик">
        {current && <CustomerCard key={current.id} customer={current} onClose={() => setOpenId(null)} />}
      </EditSheet>
    </div>
  );
}

function CustomerCard({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { is_admin } = useProfile();
  const [edit, setEdit] = useState(false);
  const info: [string, string | null][] = [
    ["ИНН", customer.inn],
    ["КПП", customer.kpp],
    ["ОГРН", customer.ogrn],
    ["Адрес", customer.legal_address],
    ["Комментарий", customer.comment],
  ];
  return (
    <div className="space-y-6">
      {edit ? (
        <CustomerForm customer={customer} onSaved={() => setEdit(false)} onCancel={() => setEdit(false)} />
      ) : (
        <div className="space-y-3">
          <div className="text-2xl font-semibold">{customer.name}</div>
          <dl className="space-y-2 text-lg">
            {info.map(([k, val]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-36 shrink-0 text-muted-foreground">{k}</dt>
                <dd>{val || "—"}</dd>
              </div>
            ))}
          </dl>
          {is_admin && (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setEdit(true)} className="h-11 text-base">
                <Pencil className="size-5" /> Изменить
              </Button>
              <DeleteButton table="customers" id={customer.id} name={customer.name} invalidate={CUSTOMERS_KEY} onDone={onClose} />
            </div>
          )}
        </div>
      )}
      <Contacts customerId={customer.id} />
    </div>
  );
}

type Contact = { id: string; full_name: string; position: string | null; phone: string | null; email: string | null; comment: string | null };

function Contacts({ customerId }: { customerId: string }) {
  const { is_admin } = useProfile();
  const key = ["dir-customer-contacts", customerId];
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_contacts")
        .select("id, full_name, position, phone, email, comment")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("sort");
      if (error) throw error;
      return data as Contact[];
    },
  });
  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Контактные лица</h3>
        {is_admin && editing === null && (
          <Button onClick={() => setEditing("new")} className="h-11 text-base">
            <Plus className="size-5" /> Добавить
          </Button>
        )}
      </div>
      {editing === "new" && <ContactForm customerId={customerId} contact={null} invalidate={key} onClose={() => setEditing(null)} />}
      {data.length === 0 && editing !== "new" && <p className="text-lg text-muted-foreground">Контактов нет</p>}
      {data.map((c) =>
        editing !== null && editing !== "new" && editing.id === c.id ? (
          <ContactForm key={c.id} customerId={customerId} contact={c} invalidate={key} onClose={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="rounded-lg border p-4 text-base">
            <div className="text-lg font-semibold">{c.full_name}</div>
            {c.position && <div className="text-muted-foreground">{c.position}</div>}
            {c.phone && <div>{c.phone}</div>}
            {c.email && <div>{c.email}</div>}
            {c.comment && <div className="text-muted-foreground">{c.comment}</div>}
            {is_admin && (
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setEditing(c)} className="h-11 text-base">
                  <Pencil className="size-5" /> Изменить
                </Button>
                <DeleteButton table="customer_contacts" id={c.id} name={c.full_name} invalidate={key} />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

function ContactForm({
  customerId,
  contact,
  invalidate,
  onClose,
}: {
  customerId: string;
  contact: Contact | null;
  invalidate: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    full_name: contact?.full_name ?? "",
    position: contact?.position ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    comment: contact?.comment ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: v.full_name.trim(),
        position: emptyToNull(v.position),
        phone: emptyToNull(v.phone),
        email: emptyToNull(v.email),
        comment: emptyToNull(v.comment),
      };
      const { error } = contact
        ? await supabase.from("customer_contacts").update(payload).eq("id", contact.id)
        : await supabase.from("customer_contacts").insert({ ...payload, customer_id: customerId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: invalidate });
      onClose();
    },
    onError: showError,
  });
  const cls = "h-12 text-lg";
  return (
    <form
      className="space-y-4 rounded-lg border bg-muted/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.full_name.trim()) return toast.error("Заполните ФИО");
        m.mutate();
      }}
    >
      <Field label="ФИО" required><Input value={v.full_name} onChange={set("full_name")} className={cls} /></Field>
      <Field label="Должность"><Input value={v.position} onChange={set("position")} className={cls} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Телефон"><Input value={v.phone} onChange={set("phone")} className={cls} /></Field>
        <Field label="Email"><Input type="email" value={v.email} onChange={set("email")} className={cls} /></Field>
      </div>
      <Field label="Комментарий"><Textarea value={v.comment} onChange={set("comment")} className="text-lg" /></Field>
      <FormActions pending={m.isPending} onCancel={onClose} />
    </form>
  );
}
