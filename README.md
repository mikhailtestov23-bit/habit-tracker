# Habit Tracker

Рабочий трекер привычек на Next.js с Supabase Auth, личным прогрессом и общей лигой участников.

## Что уже есть

- Добавление и редактирование привычек.
- Периодичность по часам, дням, неделям и выбранным дням недели.
- SQLite-база в `.data/habit-tracker.sqlite` для локального режима.
- Supabase/PostgreSQL-адаптер для Vercel.
- Регистрация и вход через Supabase Auth.
- Отдельные привычки, события, импорт/экспорт и ачивки для каждого пользователя.
- Общий дашборд участников и лидерборды по каждой привычке.
- История всех отметок в таблице `habit_events`.
- Экспорт JSON и CSV.
- Импорт JSON и CSV с предпросмотром.
- Локальные ачивки за прогресс.
- Настройки in-app/browser напоминаний.

## Локальный запуск

```bash
npm install --cache .npm-cache
npm run dev
```

После запуска приложение будет доступно на `http://localhost:3000`.

База создается автоматически при первом открытии приложения.
Dev-скрипт использует polling-режим отслеживания файлов, чтобы локальный сервер стабильнее работал в окружениях с низким лимитом открытых файлов.

## Backend-режимы

По умолчанию приложение работает локально через SQLite без регистрации.

Для Vercel используйте Supabase:

```env
DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

Если `DATA_BACKEND` не задан, приложение само переключится на Supabase, когда увидит `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SECRET_KEY` или `SUPABASE_SERVICE_ROLE_KEY`.

В Supabase-режиме интерфейс требует вход. Клиент использует `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, а серверные API routes проверяют сессию и работают с данными текущего пользователя.

## Формат CSV для импорта событий

```csv
habit_title,habit_id,occurred_at,value,note,source
"Вода утром","","2026-07-03T08:10:00.000Z",1,"После завтрака","manual"
```

Достаточно указать `habit_title` или `habit_id`. Если название совпадает с несколькими привычками, строка попадет в ошибки предпросмотра.

## Формат JSON для импорта

```json
{
  "schema_version": 1,
  "exported_at": "2026-07-03T12:00:00.000Z",
  "user": {
    "timezone": "Europe/London"
  },
  "habits": [
    {
      "id": "b7a3a6e3-8d97-4f34-8b93-7b2d78d8e620",
      "title": "Вода утром",
      "description": "Стакан воды после пробуждения.",
      "color": "#0ea5e9",
      "icon": "droplet",
      "frequency_type": "daily",
      "target_count": 1,
      "period_interval": 1,
      "period_unit": "day",
      "weekdays": null,
      "starts_at": "2026-07-01T00:00:00.000Z",
      "ends_at": null,
      "is_active": true
    }
  ],
  "events": [
    {
      "habit_id": "b7a3a6e3-8d97-4f34-8b93-7b2d78d8e620",
      "occurred_at": "2026-07-03T08:10:00.000Z",
      "value": 1,
      "note": "После завтрака",
      "source": "manual"
    }
  ],
  "reminders": []
}
```

## Production-деплой

Рекомендуемый путь: Vercel для Next.js и Supabase для PostgreSQL/Auth.

Подробная инструкция: [DEPLOYMENT.md](./DEPLOYMENT.md).

Для Supabase понадобятся:

- URL Supabase-проекта.
- Publishable key или legacy anon key.
- Secret key или legacy service role key для серверных операций.
- Включенный Email provider в Supabase Auth.

SQL-схема для Supabase лежит в [supabase/schema.sql](./supabase/schema.sql).
