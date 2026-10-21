import { createFileRoute } from "@tanstack/react-router";
import { RequestsList } from "@/components/requests/RequestsList";

export const Route = createFileRoute("/_authenticated/requests")({
  component: RequestsPage,
  head: () => ({
    meta: [
      { title: "Заявки — Лидер" },
      { name: "description", content: "Заявки по всем объектам в системе «Лидер»" },
    ],
  }),
});

function RequestsPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Заявки</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        По всем объектам. Сверху новые, затем просроченные. Поиск — по номеру заявки и значениям полей, включая номер протокола.
      </p>
      <RequestsList />
    </div>
  );
}
