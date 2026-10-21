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
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(320px,440px)_1fr]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-signal text-lg font-bold text-sidebar">Л</span>
          <span className="text-lg font-semibold text-sidebar-primary-foreground">Лидер</span>
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug text-sidebar-primary-foreground">
            Этапы, заявки и сроки
            <br />
            по каждому объекту
          </p>
          <p className="mt-3 max-w-xs text-sm text-sidebar-foreground/70">
            Видно, у кого сейчас задача, что просрочено и что ждёт ответа.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">ООО «Лидер»</p>
      </aside>
      <main className="flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Вход в систему</h1>
            <p className="mt-1 text-sm text-muted-foreground">Логин и пароль выдаёт администратор</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input id="email" type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-10 bg-card text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm">Пароль</Label>
            <Input id="password" type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="h-10 bg-card text-sm" />
          </div>
          <Button type="submit" disabled={busy} className="h-10 w-full text-sm">
            {busy ? "Входим…" : "Войти"}
          </Button>
        </form>
      </main>
    </div>
  );
}
