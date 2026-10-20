# Лидер Строительного Контроля

Делаем внутреннюю систему «Лидер» — контроль этапов строительных работ. Интерфейс полностью на русском.

Стек: React + TypeScript, Tailwind, shadcn/ui, Supabase (уже подключён).

ВАЖНО — база данных уже готова:

- НЕ создавай таблицы, миграции и RLS-политики. Схема существует, используй её как есть (сгенерируй типы из подключённого проекта).

- Статусы этапов и заявок меняются ТОЛЬКО через RPC (stage_set_status, request_set_status и др.), никогда прямым update.

- Ошибки RPC показывай пользователю текстом из сообщения исключения (toast).

- Даты показывай в формате ДД.ММ.ГГГГ, часовой пояс Europe/Moscow.

Задача сейчас — каркас:

1. Вход по email и паролю (Supabase Auth). Регистрации и «Забыли пароль» нет.

2. После входа загружать профиль текущего пользователя: profiles где user_id = auth.uid(), вместе с roles (is_admin). Если профиля нет — экран «Нет доступа. Обратитесь к администратору» и кнопка «Выйти».

3. Левое меню: «Объекты» (/objects), «Заявки» (/requests), «Справочники» (/directories), «История» (/history). Внизу меню — ФИО пользователя и кнопка «Выйти».

4. У пункта «Заявки» красный счётчик: количество строк в представлении v_requests, где is_new = true или is_overdue = true. Если 0 — не показывать.

5. Страницы пока заглушки с заголовком.

6. Стиль: максимально простой, крупные понятные кнопки и шрифт, минимум элементов — пользователи не очень уверенно работают с компьютером.

7. Вёрстка для компьютера, но без поломок на iPad горизонтально и вертикально: на узком экране меню сворачивается в кнопку-бургер.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4d32401f-0d8e-4865-9d5e-cd806a0d7cc0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
