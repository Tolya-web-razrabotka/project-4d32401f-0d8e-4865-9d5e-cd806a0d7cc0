# Развёртывание «Лидер» на сервере (Beget, Ubuntu)

Приложение собирается по инструкции Lovable для своего сервера (`NITRO_PRESET=node-server`) и работает как служба `lider` за nginx. База остаётся в Supabase — переносить ничего не нужно.

Скрипт `deploy/deploy.sh` ничего не ломает на сервере: свой Node.js 22 в `/opt/lider/node`, свой пользователь и служба, один файл сайта в nginx. Ключи в `authorized_keys` и другие сайты не трогаются.

## 1. Доступ к серверу по SSH (на своём компьютере, один раз)

Windows, PowerShell:

```powershell
ssh-keygen -t ed25519 -C "lider-deploy"
# на вопросы — Enter; файл сохранится в C:\Users\<вы>\.ssh\id_ed25519
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

Скопировать выведенную строку (начинается с `ssh-ed25519`). В панели Beget → сервер → **Файловый менеджер** → `/root/.ssh/authorized_keys` → **добавить строку в конец**, остальные строки не удалять → сохранить.

Проверка: `ssh root@IP_СЕРВЕРА` — должен пустить без пароля.

## 2. Ключ сервера для GitHub (на сервере, один раз)

Репозиторий приватный, серверу нужен свой ключ только на чтение:

```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/lider_deploy -C "lider-server"
cat >> /root/.ssh/config <<'EOF'
Host github-lider
  HostName github.com
  User git
  IdentityFile /root/.ssh/lider_deploy
  IdentitiesOnly yes
EOF
cat /root/.ssh/lider_deploy.pub
```

Строку из последней команды добавить в GitHub: репозиторий → **Settings → Deploy keys → Add deploy key**, название `server`, галочку «Allow write access» **не** ставить.

Проверка: `ssh -o StrictHostKeyChecking=accept-new -T github-lider` → «successfully authenticated».

## 3. Установка (на сервере)

```bash
mkdir -p /opt/lider
git clone github-lider:Tolya-web-razrabotka/project-4d32401f-0d8e-4865-9d5e-cd806a0d7cc0.git /opt/lider/app
bash /opt/lider/app/deploy/deploy.sh setup
```

Занимает 3–7 минут. В конце скрипт печатает адрес: `http://IP_СЕРВЕРА/`.

Если есть домен: `DOMAIN=lider.example.ru bash /opt/lider/app/deploy/deploy.sh setup` (A-запись домена должна указывать на IP сервера). HTTPS после этого: `apt install -y certbot python3-certbot-nginx && certbot --nginx -d lider.example.ru`.

## Домен и HTTPS (когда «Лидер» уже установлен)

1. У регистратора домена (или в DNS Beget) добавить A-запись: `lider.example.ru` → IP сервера. Подождать 5–30 минут.
2. На сервере:

```bash
DOMAIN=lider.example.ru bash /opt/lider/app/deploy/deploy.sh domain
certbot --nginx -d lider.example.ru --redirect
```

Меняется только файл сайта `lider` в nginx; certbot дописывает HTTPS только в него. Порт 8100 после этого закрывается. Сертификат продлевается сам.

3. Supabase → Authentication → URL Configuration: добавить `https://lider.example.ru` в Redirect URLs (для писем сброса пароля).

## Обновление после новых коммитов

```bash
bash /opt/lider/app/deploy/deploy.sh update
```

## Если что-то не так

```bash
bash /opt/lider/app/deploy/deploy.sh status   # состояние и журнал
journalctl -u lider -n 100 --no-pager          # подробный журнал
```

- Порт 3100 занят другой программой → `APP_PORT=3200 bash /opt/lider/app/deploy/deploy.sh setup`.
- Порт 80 занят не nginx (например, Apache) → скрипт nginx не трогает и открывает сайт на `http://IP:3100/`.
- На сервере уже есть другие сайты nginx и нет домена → «Лидер» получает свой порт: `http://IP:8100/` (другой — `WEB_PORT=8110`). Чужие сайты на 80/443 не затрагиваются, nginx только плавно перечитывает настройки.
- Ошибка сборки → прислать разработчику последние 40 строк вывода.

## Что где лежит

| Путь | Что |
| --- | --- |
| `/opt/lider/app` | код из GitHub и сборка `.output/` |
| `/opt/lider/node` | Node.js 22 только для «Лидера» |
| `/etc/systemd/system/lider.service` | служба, слушает `127.0.0.1:3100` |
| `/etc/nginx/sites-available/lider` | сайт nginx → `127.0.0.1:3100` |
| `/root/.ssh/lider_deploy` | ключ сервера для чтения репозитория |

Удалить всё: `systemctl disable --now lider; rm -f /etc/systemd/system/lider.service /etc/nginx/sites-enabled/lider /etc/nginx/sites-available/lider; systemctl reload nginx; rm -rf /opt/lider; userdel lider`.
