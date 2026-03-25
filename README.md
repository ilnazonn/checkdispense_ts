# checkdispense

Telegram-бот для мониторинга удалённой выдачи (dispense) на вендинговом аппарате через Telemetron API, с автологированием статистики в `reports/` и командами управления через Vendista API.

## Возможности

- Периодическая проверка удалённой выдачи (каждую минуту) и уведомления в Telegram при ошибках/восстановлении.
- Команды в Telegram:
  - `/start` — приветствие
  - `/help` — справка по командам
  - `/check` — ручная проверка выдачи через Telemetron API
  - `/reboot` — отправка команды перезагрузки терминала через Vendista
  - `/apivendistachk` — команда проверки API (Vendista command_id = 40)
  - `/statistic` — показать сводку за день (как текст)
  - `/getfile` — прислать `reports/logs_archive.csv`
  - `/getstatisticfile` — прислать `reports/api_log.csv`
  - `/geterrorsfile` — прислать `reports/errors.csv` (детальные ошибки одной строкой)
  - `/restart` — `pm2 restart check_dispense`
  - `status` — `pm2 describe check_dispense`
  - `/changeterminal` — обновить `VENDISTA_ID` в `.env`

## Требования

- Node.js (рекомендуется LTS)
- npm
- `pm2` (обязательно): часть команд бота вызывает `pm2` на сервере (`/restart`, `status`)

## Установка

```bash
npm ci
```

## Настройка окружения

Создайте файл `.env` в корне проекта.

Обязательные переменные (используются в коде):

- `TELEGRAM_TOKEN` — токен Telegram-бота
- `TELEGRAM_CHAT_ID` — chat_id, куда бот шлёт уведомления
- `VM_ID` — id аппарата в Telemetron
- `CLIENT_ID` — Telemetron client_id
- `CLIENT_SECRET` — Telemetron client_secret
- `USERNME` — Telemetron username (в коде используется именно ключ `USERNME`)
- `PASSWORD` — Telemetron password
- `VENDISTA_LOGIN` — логин Vendista
- `VENDISTA_PASSWORD` — пароль Vendista
- `VENDISTA_ID` — id терминала в Vendista

## Сборка и запуск

Сборка TypeScript:

```bash
npm run build
```

Запуск под PM2 (обязательно):

```bash
npm i -g pm2
pm2 start dist/check_dispense.js --name "check_dispense" --env .env
pm2 save
```

## Логи и отчёты

Проект пишет файлы в папку `reports/`:

- `reports/api_log.csv` — текущая дневная статистика (1 строка с заголовком)
- `reports/logs_archive.csv` — архив/история статистики (CSV, 1 строка на день)
- `reports/errors.csv` — детальный лог ошибок (CSV, 1 строка = 1 ошибка)
- при достижении лимита размера создаются архивы вида `reports/statistics_<date>.csv.gz`

Убедитесь, что процесс имеет права на запись в `reports/` (папка создаётся/используется во время работы).

## Почему нужен PM2

Команды `/restart` и `status` выполняют локальные команды `pm2` на сервере. Если запустить бота без PM2 (например, `npm start`), эти команды работать не будут.

## Заметки по безопасности

В текущем виде `src/components/config.ts` выводит значения секретов в stdout через `console.log`. Для продакшена это лучше убрать, чтобы токены/пароли не попадали в логи.

