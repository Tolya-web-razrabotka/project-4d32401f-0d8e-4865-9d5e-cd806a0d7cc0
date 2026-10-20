import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/requests")({
  component: () => <h1 className="text-3xl font-bold">Заявки</h1>,
  head: () => ({
    meta: [
      { title: "Заявки — Лидер" },
      { name: "description", content: "Заявки в системе «Лидер»" },
      { property: "og:title", content: "Заявки — Лидер" },
      { property: "og:description", content: "Заявки в системе «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
