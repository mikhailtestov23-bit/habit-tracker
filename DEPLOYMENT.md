# Деплой на Vercel + Supabase

## Что уже подготовлено

- Приложение может работать через локальный SQLite или через Supabase/PostgreSQL.
- Для Vercel добавлен serverless-safe Supabase-адаптер.
- Регистрация и вход работают через Supabase Auth.
- В Supabase-режиме API routes требуют Bearer-токен текущего пользователя.
- Общая лига и лидерборды строятся по всем зарегистрированным пользователям приложения.
- SQL-схема лежит в `supabase/schema.sql`.
- Vercel Cron настроен в `vercel.json` и вызывает `/api/cron/reminders` один раз в день.

## 1. Создать Supabase-проект

1. Откройте Supabase Dashboard.
2. Создайте новый проект.
3. Откройте SQL Editor.
4. Выполните файл `supabase/schema.sql`.

После этого таблицы будут готовы:

- `users`
- `habits`
- `habit_events`
- `reminders`
- `achievements`
- `user_achievements`

Схема включает Row Level Security и политики. Текущая серверная часть проверяет Supabase Auth-сессию пользователя, а затем читает и пишет данные через серверный secret/service key.

В Supabase Authentication → Providers проверьте, что Email включен. Если включено подтверждение email, после регистрации пользователь должен подтвердить адрес в письме перед первым входом.

В Supabase Authentication → URL Configuration укажите production-адрес приложения:

- Site URL: `https://habit-tracker-ruby-zeta.vercel.app`
- Redirect URLs: `https://habit-tracker-ruby-zeta.vercel.app/**`

Для локальной разработки можно дополнительно добавить:

- `http://localhost:3000/**`

Приложение при регистрации также передает `emailRedirectTo` с текущим доменом, но Supabase должен заранее разрешать этот домен в Redirect URLs.
Если старое письмо уже ушло на `localhost`, после исправления настроек запросите новое письмо кнопкой "Отправить письмо еще раз" на экране регистрации.

## 2. Получить Supabase keys

В Supabase возьмите:

- Project URL.
- Publishable key для публичной переменной.
- Secret key для серверной переменной.

Если проект пока использует legacy-ключи, можно взять:

- anon key вместо publishable key;
- service_role key вместо secret key.

Не добавляйте secret/service key в переменные с префиксом `NEXT_PUBLIC_`.

## 3. Настроить Vercel Environment Variables

В Vercel Project Settings → Environment Variables добавьте:

```env
DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
CRON_SECRET=любая-длинная-случайная-строка
```

Для legacy-ключей:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Переменные нужно добавить минимум в Production. Для тестовых деплоев добавьте их также в Preview.

## 4. Задеплоить на Vercel

Через Git:

1. Создайте репозиторий.
2. Подключите его в Vercel.
3. Build command: `npm run build`.
4. Output directory: оставить пустым, Vercel сам определит Next.js.

Через Vercel CLI:

```bash
npx vercel
npx vercel --prod
```

## 5. Проверить после деплоя

Откройте:

- `/` — интерфейс трекера.
- `/api/state` — состояние приложения, требует вход.
- `/api/export` — JSON-экспорт, требует вход.
- `/api/cron/reminders` — cron endpoint.

При первом входе нового пользователя приложение создаст профиль и стартовые привычки для него.

## 6. Что можно добавить дальше

- Приватные команды/комнаты вместо одной общей лиги.
- Добавить настоящую отправку push/email в `/api/cron/reminders`.
- Перенести существующие локальные SQLite-данные через JSON export/import.
- Подключить домен в Vercel.

## Официальные страницы

- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
