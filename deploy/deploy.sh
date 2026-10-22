#!/usr/bin/env bash
# =====================================================================
# «Лидер» — развёртывание на собственном сервере (Ubuntu, root)
#
#   bash deploy/deploy.sh setup    — первый запуск: всё ставит, собирает и запускает
#   bash deploy/deploy.sh update   — обновить до последней версии из GitHub
#   bash deploy/deploy.sh status   — состояние службы и последние строки журнала
#
# Изолировано от того, что уже есть на сервере:
#   • свой Node.js 22 в /opt/lider/node (системный node не трогаем);
#   • свой пользователь «lider» и служба systemd «lider»;
#   • приложение слушает только 127.0.0.1:${APP_PORT}, наружу — через nginx;
#   • в nginx добавляется ОДИН файл /etc/nginx/sites-available/lider,
#     чужие сайты и настройки не меняются; если порт 80 занят не nginx —
#     nginx не трогаем, приложение открывается напрямую на порту.
#   • ~/.ssh/authorized_keys не трогаем.
#
# Сборка — по инструкции Lovable для своего сервера: NITRO_PRESET=node-server,
# запуск node .output/server/index.mjs на Node.js 22.
# =====================================================================
set -euo pipefail

APP_ROOT=/opt/lider
APP_DIR="$APP_ROOT/app"
NODE_DIR="$APP_ROOT/node"
NODE_VERSION="${NODE_VERSION:-22.12.0}"
[ -n "${APP_PORT:-}" ] && APP_PORT_SET=1
APP_PORT="${APP_PORT:-3100}"
APP_USER=lider
SERVICE=lider
DOMAIN="${DOMAIN:-}"                     # домен, если есть; иначе — по IP
export PATH="$NODE_DIR/bin:$HOME/.bun/bin:$PATH"
URL=""
# При обновлении берём порт из уже созданной службы
if [ -z "${APP_PORT_SET:-}" ] && [ -f "/etc/systemd/system/lider.service" ]; then
  APP_PORT="$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/lider.service | head -1)"
  APP_PORT="${APP_PORT:-3100}"
fi

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m  ✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Запустите от root"
[ -d "$APP_DIR/.git" ] || die "Нет $APP_DIR — сначала клонируйте репозиторий (см. deploy/README.md)"

install_packages() {
  say "Пакеты: git, curl, unzip, xz, nginx"
  local need=()
  for p in git curl unzip xz-utils ca-certificates; do dpkg -s "$p" >/dev/null 2>&1 || need+=("$p"); done
  if [ ${#need[@]} -gt 0 ]; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${need[@]}"
  fi
  ok "базовые пакеты на месте"
}

install_node() {
  if [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v | grep -q '^v22\.'; then
    ok "Node.js $("$NODE_DIR/bin/node" -v) уже установлен в $NODE_DIR"; return
  fi
  say "Node.js $NODE_VERSION (отдельно от системного) → $NODE_DIR"
  local arch; case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) die "Неизвестная архитектура $(uname -m)";; esac
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$arch.tar.xz" -o "$tmp/node.tar.xz"
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf "$tmp/node.tar.xz" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
  ok "Node.js $("$NODE_DIR/bin/node" -v)"
}

install_bun() {
  # bun нужен только для установки зависимостей строго по bun.lock (как в Lovable)
  if command -v bun >/dev/null 2>&1; then ok "bun $(bun --version)"; return; fi
  say "bun (менеджер пакетов проекта)"
  curl -fsSL https://bun.sh/install | bash >/dev/null
  export PATH="$HOME/.bun/bin:$PATH"
  ok "bun $(bun --version)"
}

ensure_user() {
  id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
  ok "пользователь службы: $APP_USER"
}

build_app() {
  say "Зависимости и сборка (несколько минут)"
  cd "$APP_DIR"
  if ! bun install --frozen-lockfile; then
    warn "bun.lock не совпал с package.json — ставлю без заморозки версий"
    bun install
  fi
  rm -rf .output
  local vite=./node_modules/vite/bin/vite.js; [ -f "$vite" ] || vite=./node_modules/.bin/vite
  NITRO_PRESET=node-server NODE_ENV=production node "$vite" build
  [ -f .output/server/index.mjs ] || die "Сборка не создала .output/server/index.mjs"
  if [ -f .output/nitro.json ] && ! grep -q '"node-server"\|"node"' .output/nitro.json; then
    die "Собралось не под Node.js (см. .output/nitro.json) — пришлите вывод разработчику"
  fi
  bun pm cache rm >/dev/null 2>&1 || true   # на сервере мало места — кэш пакетов не храним
  chown -R "$APP_USER:$APP_USER" "$APP_DIR/.output"
  ok "сборка готова: .output/server/index.mjs"
}

write_service() {
  say "Служба systemd «$SERVICE» на 127.0.0.1:$APP_PORT"
  if ss -ltn "( sport = :$APP_PORT )" | grep -q LISTEN && ! systemctl is-active --quiet "$SERVICE"; then
    die "Порт $APP_PORT уже занят другой программой. Запустите с другим портом: APP_PORT=3200 bash deploy/deploy.sh setup"
  fi
  cat > "/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=Lider — система контроля этапов работ
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$APP_PORT
ExecStart=$NODE_DIR/bin/node $APP_DIR/.output/server/index.mjs
Restart=always
RestartSec=3
MemoryMax=1G

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --quiet "$SERVICE"
  systemctl restart "$SERVICE"
  for _ in $(seq 1 20); do
    curl -fs -o /dev/null "http://127.0.0.1:$APP_PORT/login" && { ok "приложение отвечает на 127.0.0.1:$APP_PORT"; return; }
    sleep 1
  done
  journalctl -u "$SERVICE" -n 40 --no-pager || true
  die "Приложение не ответило за 20 секунд — журнал выше"
}

port80_owner() { ss -ltnp '( sport = :80 )' 2>/dev/null | awk 'NR>1{print $NF}' | head -1; }

setup_nginx() {
  # После certbot файл сайта содержит настройки HTTPS — перезаписывать его нельзя
  if grep -qs 'managed by Certbot' /etc/nginx/sites-available/lider; then
    URL="https://$(grep -m1 -oP 'server_name\s+\K[^ ;]+' /etc/nginx/sites-available/lider)/"
    ok "nginx уже настроен с HTTPS — не меняю ($URL)"; return
  fi
  local owner; owner="$(port80_owner)"
  if [ -n "$owner" ] && ! echo "$owner" | grep -q nginx; then
    warn "Порт 80 занят не nginx ($owner) — nginx не трогаю"
    expose_direct; return
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    say "Устанавливаю nginx"
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
  fi
  local name="${DOMAIN:-$(server_ip)}"
  # Без домена на сервере с другими сайтами порт 80 по IP уже кто-то обслуживает —
  # тогда «Лидер» получает свой отдельный порт и чужие сайты не пересекаются с ним.
  local others; others="$(find /etc/nginx/sites-enabled /etc/nginx/conf.d -mindepth 1 ! -name lider ! -name default 2>/dev/null | wc -l)"
  local web_port="${WEB_PORT:-}"
  if [ -z "$web_port" ]; then
    if [ -n "$DOMAIN" ] || [ "$others" -eq 0 ]; then web_port=80; else web_port=8100; fi
  fi
  if [ "$web_port" != 80 ] && ss -ltn "( sport = :$web_port )" | grep -q LISTEN \
     && ! grep -qs "listen $web_port;" /etc/nginx/sites-available/lider; then
    die "Порт $web_port занят. Запустите с другим: WEB_PORT=8110 bash deploy/deploy.sh setup"
  fi
  say "nginx: сайт «lider» на порту $web_port → 127.0.0.1:$APP_PORT"
  cat > /etc/nginx/sites-available/lider <<EOF
# «Лидер» — добавлено deploy/deploy.sh. Другие сайты не затрагиваются.
server {
    listen $web_port;
    server_name $name;
    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/lider /etc/nginx/sites-enabled/lider
  # Стандартная заглушка nginx перехватила бы запросы по IP — отключаем, только если других сайтов нет
  if [ -z "$DOMAIN" ] && [ -L /etc/nginx/sites-enabled/default ] \
     && [ "$(find /etc/nginx/sites-enabled -mindepth 1 | wc -l)" -le 2 ]; then
    rm -f /etc/nginx/sites-enabled/default && warn "отключена стандартная страница nginx (файл сохранён в sites-available)"
  fi
  nginx -t >/dev/null 2>&1 || { nginx -t; rm -f /etc/nginx/sites-enabled/lider; die "Ошибка в конфиге nginx — сайт lider отключён, остальное не тронуто"; }
  # Только плавная перезагрузка: работающие сайты не прерываются. Перезапуск nginx не делаем.
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx || die "nginx не перечитал настройки — сайт lider добавлен, но другие сайты работают как прежде"
  else
    systemctl enable --quiet nginx; systemctl start nginx
  fi
  open_port "$web_port"
  if [ "$web_port" = 80 ]; then URL="http://$name/"; else URL="http://$name:$web_port/"; fi
  ok "сайт: $URL"
}

expose_direct() {
  # Без nginx: приложение слушает все адреса на своём порту
  sed -i "s/^Environment=HOST=127.0.0.1/Environment=HOST=0.0.0.0/" "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload && systemctl restart "$SERVICE"
  open_port "$APP_PORT"
  URL="http://$(server_ip):$APP_PORT/"
  ok "сайт: $URL"
}

open_port() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$1/tcp" >/dev/null && ok "открыт порт $1 в ufw"
  fi
}

server_ip() { curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'; }

pull_code() {
  say "Код из GitHub"
  cd "$APP_DIR"
  git fetch --quiet origin main
  git reset --quiet --hard origin/main   # на сервере код не правится — только из GitHub
  ok "версия: $(git log -1 --format='%h %s')"
}

case "${1:-}" in
  setup)
    install_packages; install_node; install_bun; ensure_user
    build_app; write_service; setup_nginx
    say "Готово"; echo "  Откройте: $URL"
    echo "  Обновление потом: bash $APP_DIR/deploy/deploy.sh update"
    ;;
  update)
    pull_code; install_node; install_bun; build_app
    systemctl restart "$SERVICE"
    for _ in $(seq 1 20); do curl -fs -o /dev/null "http://127.0.0.1:$APP_PORT/login" && { ok "обновлено и работает"; exit 0; }; sleep 1; done
    journalctl -u "$SERVICE" -n 40 --no-pager; die "После обновления приложение не отвечает — журнал выше"
    ;;
  domain)
    # Подключить домен к уже установленному «Лидеру»: меняется только файл сайта lider в nginx
    [ -n "$DOMAIN" ] || die "Укажите домен: DOMAIN=lider.example.ru bash deploy/deploy.sh domain"
    systemctl is-active --quiet "$SERVICE" || die "Служба $SERVICE не запущена — сначала setup"
    ip_dns="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
    [ "$ip_dns" = "$(server_ip)" ] || die "Домен $DOMAIN указывает на «${ip_dns:-никуда}», а не на этот сервер. Проверьте A-запись и подождите обновления DNS"
    setup_nginx
    if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^8100/tcp'; then
      ufw delete allow 8100/tcp >/dev/null && ok "закрыт старый порт 8100 в ufw"
    fi
    say "Готово"; echo "  Сайт: $URL"
    echo "  HTTPS: certbot --nginx -d $DOMAIN --redirect"
    ;;
  status)
    systemctl status "$SERVICE" --no-pager -l | head -15; journalctl -u "$SERVICE" -n 20 --no-pager
    ;;
  *) echo "Использование: bash deploy/deploy.sh setup | update | domain | status"; exit 1 ;;
esac
