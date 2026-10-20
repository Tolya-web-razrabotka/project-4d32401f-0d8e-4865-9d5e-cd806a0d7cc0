import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/history")({
  component: () => <h1 className="text-3xl font-bold">История</h1>,
  head: () => ({
    meta: [
      { title: "История — Лидер" },
      { name: "description", content: "История в системе «Лидер»" },
      { property: "og:title", content: "История — Лидер" },
      { property: "og:description", content: "История в системе «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
