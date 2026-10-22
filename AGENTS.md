<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Проект «Лидер» — контекст для доработок

Перед любыми изменениями прочитать:

1. **Техническое задание** — версия 1 выполнена по нему полностью (`docs/ПРИЁМКА.md` — 31 критерий раздела 11).
2. **`docs/ПРАВКИ.md`** — правки, появившиеся после ТЗ. Где правка и ТЗ расходятся, действует правка. Каждую новую правку записывать туда со статусом и коммитом.
3. **`db/README.md`** — порядок SQL-скриптов. Схему меняем только новыми файлами `db/NN_*.sql`, не через панель Supabase и не правкой старых скриптов.

Правила кода, на которых держится ТЗ:

- Статусы этапа и заявки меняются только через RPC (`stage_set_status`, `request_set_status`), никогда прямым `update`.
- Права проверяются в БД (RLS); скрытие кнопок в интерфейсе — дополнительно, не вместо.
- Расчёты (просрочка, «нет ответа», готовность, счётчики) — в представлениях `v_*`, не на фронте.
- Ошибки RPC показывать пользователю текстом исключения (`showError`).
- Интерфейс на русском, крупные элементы, без поломок на iPad.

Развёртывание на сервер заказчика/студии — `deploy/README.md` и `deploy/deploy.sh` (сборка `NITRO_PRESET=node-server`, служба `lider` за nginx). `vite.config.ts` для этого не меняем — в Lovable сборка остаётся прежней.
