import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/objects")({
  component: () => <h1 className="text-3xl font-bold">Объекты</h1>,
  head: () => ({
    meta: [
      { title: "Объекты — Лидер" },
      { name: "description", content: "Объекты в системе «Лидер»" },
      { property: "og:title", content: "Объекты — Лидер" },
      { property: "og:description", content: "Объекты в системе «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
