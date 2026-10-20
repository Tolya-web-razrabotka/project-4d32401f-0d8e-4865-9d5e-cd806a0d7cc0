import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HistoryFeed } from "@/components/history/HistoryFeed";
import { useObjects } from "@/components/objects/data";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "История — Лидер" },
      { name: "description", content: "Журнал действий в системе «Лидер»" },
    ],
  }),
});

const ALL = "__all";
const TYPES = [
  { v: "stage", label: "Этапы" },
  { v: "request", label: "Заявки" },
  { v: "object", label: "Объекты" },
];

/** Общая лента истории с фильтрами по объекту, типу и периоду (ТЗ 7.10). */
function HistoryPage() {
  const { data: objects = [] } = useObjects();
  const [objectId, setObjectId] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">История</h1>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={objectId} onValueChange={setObjectId}>
          <SelectTrigger className="h-12 w-72 text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-base">Все объекты</SelectItem>
            {objects.map((o) => (
              <SelectItem key={o.id} value={o.id} className="text-base">{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-12 w-48 text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-base">Всё</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t.v} value={t.v} className="text-base">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-lg">
          с <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-12 w-44 text-lg" />
          по <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-12 w-44 text-lg" />
        </label>
        {(objectId !== ALL || type !== ALL || from || to) && (
          <Button
            variant="ghost"
            className="h-12 text-lg"
            onClick={() => {
              setObjectId(ALL);
              setType(ALL);
              setFrom("");
              setTo("");
            }}
          >
            Сбросить
          </Button>
        )}
      </div>
      <HistoryFeed
        showObject={objectId === ALL}
        filter={{
          ...(objectId !== ALL ? { objectId } : {}),
          ...(type !== ALL ? { entityType: type } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          limit: 500,
        }}
      />
    </div>
  );
}
