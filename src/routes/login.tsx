import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError } from "@/lib/format";
import { clearOverdueAck } from "@/components/OverdueDialog";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Вход — Лидер" },
      { name: "description", content: "Вход в систему «Лидер»" },
      { property: "og:title", content: "Вход — Лидер" },
      { property: "og:description", content: "Вход в систему «Лидер»" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      showError(error.message === "Invalid login credentials" ? { message: "Неверный email или пароль" } : error);
      return;
    }
    clearOverdueAck(); // окно «Просрочено» показывается при каждом входе
    navigate({ to: "/objects", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-center text-xl font-bold">Лидер</h1>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm">Email</Label>
          <Input id="email" type="email" required autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} className="h-10 text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm">Пароль</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className="h-10 text-sm" />
        </div>
        <Button type="submit" disabled={busy} className="h-10 w-full text-sm">
          {busy ? "Входим…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
