import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/directories")({
  component: () => <h1 className="text-3xl font-bold">Справочники</h1>,
  head: () => ({
    meta: [
      { title: "Справочники — Лидер" },
      { name: "description", content: "Справочники в системе «Лидер»" },
      { property: "og:title", content: "Справочники — Лидер" },
      { property: "og:description", content: "Справочники в системе «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
