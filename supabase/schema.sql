create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  color text not null default '#14b8a6',
  icon text not null default 'circle-check',
  frequency_type text not null check (frequency_type in ('hourly', 'daily', 'weekly', 'custom')),
  target_count integer not null default 1 check (target_count > 0),
  period_interval integer not null default 1 check (period_interval > 0),
  period_unit text not null check (period_unit in ('hour', 'day', 'week')),
  weekdays jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weekdays is null or jsonb_typeof(weekdays) = 'array')
);

create table if not exists public.habit_events (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  value numeric not null default 1 check (value > 0),
  note text,
  source text not null check (source in ('manual', 'import', 'reminder', 'automation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'in_app')),
  time_of_day text not null default '09:00' check (time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'UTC',
  weekdays jsonb,
  is_enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weekdays is null or jsonb_typeof(weekdays) = 'array')
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  icon text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  condition_type text not null,
  condition_value integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  habit_id uuid references public.habits(id) on delete set null,
  unlocked_at timestamptz not null default now()
);

create index if not exists idx_habits_user_active on public.habits(user_id, is_active, created_at desc);
create index if not exists idx_habit_events_habit_time on public.habit_events(habit_id, occurred_at desc);
create index if not exists idx_habit_events_user_time on public.habit_events(user_id, occurred_at desc);
create index if not exists idx_reminders_user_time on public.reminders(user_id, time_of_day);

create unique index if not exists user_achievements_global_unique
  on public.user_achievements(user_id, achievement_id)
  where habit_id is null;

create unique index if not exists user_achievements_habit_unique
  on public.user_achievements(user_id, achievement_id, habit_id)
  where habit_id is not null;

alter table public.users enable row level security;
alter table public.habits enable row level security;
alter table public.habit_events enable row level security;
alter table public.reminders enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Users can manage own profile" on public.users;
create policy "Users can manage own profile"
  on public.users
  for all
  to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

drop policy if exists "Users can manage own habits" on public.habits;
create policy "Users can manage own habits"
  on public.habits
  for all
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "Users can manage own habit events" on public.habit_events;
create policy "Users can manage own habit events"
  on public.habit_events
  for all
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "Users can manage own reminders" on public.reminders;
create policy "Users can manage own reminders"
  on public.reminders
  for all
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "Authenticated users can read achievements" on public.achievements;
create policy "Authenticated users can read achievements"
  on public.achievements
  for select
  to authenticated
  using (true);

drop policy if exists "Users can manage own unlocked achievements" on public.user_achievements;
create policy "Users can manage own unlocked achievements"
  on public.user_achievements
  for all
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

insert into public.users (id, email, name, timezone)
values ('local-user', null, 'Local user', 'Europe/London')
on conflict (id) do update set
  timezone = excluded.timezone,
  updated_at = now();

insert into public.achievements (code, title, description, icon, rarity, condition_type, condition_value)
values
  ('first_checkin', 'Первый шаг', 'Первая отмеченная привычка.', 'sparkles', 'common', 'event_count', 1),
  ('three_day_streak', 'Три дня подряд', 'Привычка выполнена 3 дня подряд.', 'flame', 'rare', 'streak', 3),
  ('seven_day_streak', 'Неделя в огне', 'Семь дней уверенного ритма.', 'trophy', 'epic', 'streak', 7),
  ('perfect_week', 'Идеальная неделя', 'Все активные привычки закрыты в текущей неделе.', 'crown', 'legendary', 'perfect_week', 1),
  ('comeback', 'Возвращение', 'Привычка выполнена после паузы 7+ дней.', 'rotate', 'rare', 'gap', 7),
  ('hundred_events', 'Мастер ритма', '100 выполнений одной привычки.', 'badge', 'legendary', 'habit_event_count', 100)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  rarity = excluded.rarity,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value;
