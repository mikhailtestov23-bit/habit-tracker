import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  Achievement,
  EventSource,
  FrequencyType,
  Habit,
  HabitEvent,
  ImportPayload,
  PeriodUnit,
  Reminder,
  ReminderChannel,
  SocialSnapshot,
  UnlockedAchievement
} from "@/lib/types";
import { nowIso } from "@/lib/time";

export const LOCAL_USER_ID = "local-user";
export const DEFAULT_TIMEZONE = "Europe/London";

const DB_PATH = join(process.cwd(), ".data", "habit-tracker.sqlite");

type SqlRow = Record<string, unknown>;

function sqlite(command: string, args: string[] = [], json = false) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const result = spawnSync("sqlite3", [...(json ? ["-json"] : []), DB_PATH, ...args], {
    input: command,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "SQLite command failed");
  }

  return result.stdout.trim();
}

export function sqlString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? String(value) : String(fallback);
}

function sqlBoolean(value: boolean | null | undefined) {
  return value ? "1" : "0";
}

function sqlJson(value: unknown) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return sqlString(JSON.stringify(value));
}

function parseJsonArray(value: unknown): number[] | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter((day) => day >= 1 && day <= 7) : null;
  } catch {
    return null;
  }
}

function mapHabit(row: SqlRow): Habit {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    color: String(row.color),
    icon: String(row.icon),
    frequency_type: String(row.frequency_type) as FrequencyType,
    target_count: Number(row.target_count),
    period_interval: Number(row.period_interval),
    period_unit: String(row.period_unit) as PeriodUnit,
    weekdays: parseJsonArray(row.weekdays),
    starts_at: String(row.starts_at),
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: Boolean(Number(row.is_active)),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapEvent(row: SqlRow): HabitEvent {
  return {
    id: String(row.id),
    habit_id: String(row.habit_id),
    user_id: String(row.user_id),
    occurred_at: String(row.occurred_at),
    value: Number(row.value),
    note: row.note ? String(row.note) : null,
    source: String(row.source) as EventSource,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapReminder(row: SqlRow): Reminder {
  return {
    id: String(row.id),
    habit_id: String(row.habit_id),
    user_id: String(row.user_id),
    channel: String(row.channel) as ReminderChannel,
    time_of_day: String(row.time_of_day),
    timezone: String(row.timezone),
    weekdays: parseJsonArray(row.weekdays),
    is_enabled: Boolean(Number(row.is_enabled)),
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapAchievement(row: SqlRow): Achievement {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    description: String(row.description),
    icon: String(row.icon),
    rarity: String(row.rarity) as Achievement["rarity"],
    condition_type: String(row.condition_type),
    condition_value: Number(row.condition_value),
    created_at: String(row.created_at)
  };
}

function query<T>(sql: string, mapper: (row: SqlRow) => T): T[] {
  ensureDatabase();
  const output = sqlite(`PRAGMA foreign_keys = ON;\n${sql}`, [], true);
  if (!output) {
    return [];
  }

  return (JSON.parse(output) as SqlRow[]).map(mapper);
}

function exec(sql: string) {
  ensureDatabase();
  sqlite(`PRAGMA foreign_keys = ON;\n${sql}`);
}

let initialized = false;

export function ensureDatabase() {
  if (initialized) {
    return;
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });
  sqlite(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      timezone TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      frequency_type TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      period_interval INTEGER NOT NULL,
      period_unit TEXT NOT NULL,
      weekdays TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_events (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 1,
      note TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      time_of_day TEXT NOT NULL,
      timezone TEXT NOT NULL,
      weekdays TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      last_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      rarity TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      condition_value INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      habit_id TEXT,
      unlocked_at TEXT NOT NULL,
      UNIQUE(user_id, achievement_id, habit_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_habit_events_habit_time ON habit_events(habit_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_habit_events_user_time ON habit_events(user_id, occurred_at);
  `);

  const timestamp = nowIso();
  sqlite(`
    INSERT OR IGNORE INTO users (id, email, name, timezone, created_at, updated_at)
    VALUES (${sqlString(LOCAL_USER_ID)}, NULL, 'Local user', ${sqlString(DEFAULT_TIMEZONE)}, ${sqlString(timestamp)}, ${sqlString(timestamp)});
  `);
  initialized = true;
  seedAchievements();
  seedStarterHabits();
}

function seedAchievements() {
  const timestamp = nowIso();
  const achievements = [
    ["first_checkin", "Первый шаг", "Первая отмеченная привычка.", "sparkles", "common", "event_count", 1],
    ["three_day_streak", "Три дня подряд", "Привычка выполнена 3 дня подряд.", "flame", "rare", "streak", 3],
    ["seven_day_streak", "Неделя в огне", "Семь дней уверенного ритма.", "trophy", "epic", "streak", 7],
    ["perfect_week", "Идеальная неделя", "Все активные привычки закрыты в текущей неделе.", "crown", "legendary", "perfect_week", 1],
    ["comeback", "Возвращение", "Привычка выполнена после паузы 7+ дней.", "rotate", "rare", "gap", 7],
    ["hundred_events", "Мастер ритма", "100 выполнений одной привычки.", "badge", "legendary", "habit_event_count", 100]
  ];

  sqlite(
    achievements
      .map(
        ([code, title, description, icon, rarity, conditionType, conditionValue]) => `
          INSERT INTO achievements (id, code, title, description, icon, rarity, condition_type, condition_value, created_at)
          VALUES (${sqlString(crypto.randomUUID())}, ${sqlString(String(code))}, ${sqlString(String(title))}, ${sqlString(
            String(description)
          )}, ${sqlString(String(icon))}, ${sqlString(String(rarity))}, ${sqlString(String(conditionType))}, ${sqlNumber(
            Number(conditionValue)
          )}, ${sqlString(timestamp)})
          ON CONFLICT(code) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            icon = excluded.icon,
            rarity = excluded.rarity,
            condition_type = excluded.condition_type,
            condition_value = excluded.condition_value;
        `
      )
      .join("\n")
  );
}

function seedStarterHabits() {
  const hasHabits = query("SELECT * FROM habits LIMIT 1;", mapHabit).length > 0;
  if (hasHabits) {
    return;
  }

  const timestamp = nowIso();
  const waterId = crypto.randomUUID();
  const readingId = crypto.randomUUID();
  sqlite(`
    INSERT INTO habits (id, user_id, title, description, color, icon, frequency_type, target_count, period_interval, period_unit, weekdays, starts_at, ends_at, is_active, created_at, updated_at)
    VALUES
      (${sqlString(waterId)}, ${sqlString(LOCAL_USER_ID)}, 'Вода утром', 'Стакан воды после пробуждения.', '#0ea5e9', 'droplet', 'daily', 1, 1, 'day', NULL, ${sqlString(timestamp)}, NULL, 1, ${sqlString(timestamp)}, ${sqlString(timestamp)}),
      (${sqlString(readingId)}, ${sqlString(LOCAL_USER_ID)}, 'Чтение', 'Минимум одна сессия чтения.', '#f97316', 'book-open', 'weekly', 3, 1, 'week', NULL, ${sqlString(timestamp)}, NULL, 1, ${sqlString(timestamp)}, ${sqlString(timestamp)});

    INSERT INTO reminders (id, habit_id, user_id, channel, time_of_day, timezone, weekdays, is_enabled, last_sent_at, created_at, updated_at)
    VALUES (${sqlString(crypto.randomUUID())}, ${sqlString(waterId)}, ${sqlString(LOCAL_USER_ID)}, 'in_app', '09:00', ${sqlString(DEFAULT_TIMEZONE)}, ${sqlJson([1, 2, 3, 4, 5, 6, 7])}, 1, NULL, ${sqlString(timestamp)}, ${sqlString(timestamp)});
  `);
}

export function getTimezone() {
  const rows = query<{ timezone: string }>("SELECT timezone FROM users WHERE id = 'local-user';", (row) => ({
    timezone: String(row.timezone)
  }));
  return rows[0]?.timezone || DEFAULT_TIMEZONE;
}

export function getHabits() {
  return query("SELECT * FROM habits WHERE user_id = 'local-user' ORDER BY is_active DESC, created_at DESC;", mapHabit);
}

export function getEvents() {
  return query("SELECT * FROM habit_events WHERE user_id = 'local-user' ORDER BY occurred_at DESC;", mapEvent);
}

export function getReminders() {
  return query("SELECT * FROM reminders WHERE user_id = 'local-user' ORDER BY time_of_day ASC;", mapReminder);
}

export function getAchievements() {
  return query("SELECT * FROM achievements ORDER BY condition_value ASC;", mapAchievement);
}

export function getUnlockedAchievements() {
  return query<UnlockedAchievement>(
    `
      SELECT ua.*, a.code, a.title, a.description, a.icon, a.rarity, a.condition_type, a.condition_value, a.created_at AS achievement_created_at, h.title AS habit_title
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      LEFT JOIN habits h ON h.id = ua.habit_id
      WHERE ua.user_id = 'local-user'
      ORDER BY ua.unlocked_at DESC;
    `,
    (row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      achievement_id: String(row.achievement_id),
      habit_id: row.habit_id ? String(row.habit_id) : null,
      unlocked_at: String(row.unlocked_at),
      habit_title: row.habit_title ? String(row.habit_title) : null,
      achievement: {
        id: String(row.achievement_id),
        code: String(row.code),
        title: String(row.title),
        description: String(row.description),
        icon: String(row.icon),
        rarity: String(row.rarity) as Achievement["rarity"],
        condition_type: String(row.condition_type),
        condition_value: Number(row.condition_value),
        created_at: String(row.achievement_created_at)
      }
    })
  );
}

export function getUserProfile() {
  return {
    id: LOCAL_USER_ID,
    email: null,
    name: "Local user",
    timezone: getTimezone()
  };
}

export function getSocialSnapshot(): SocialSnapshot {
  return {
    users: [getUserProfile()],
    habits: getHabits(),
    events: getEvents(),
    reminders: getReminders()
  };
}

export function createHabit(input: {
  id?: string;
  title: string;
  description?: string | null;
  color: string;
  icon: string;
  frequency_type: FrequencyType;
  target_count: number;
  period_interval: number;
  period_unit: PeriodUnit;
  weekdays?: number[] | null;
  starts_at?: string;
  ends_at?: string | null;
  reminder?: {
    is_enabled: boolean;
    time_of_day: string;
    weekdays?: number[] | null;
  };
}) {
  const timestamp = nowIso();
  const id = input.id || crypto.randomUUID();
  exec(`
    INSERT INTO habits (id, user_id, title, description, color, icon, frequency_type, target_count, period_interval, period_unit, weekdays, starts_at, ends_at, is_active, created_at, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(LOCAL_USER_ID)}, ${sqlString(input.title)}, ${sqlString(input.description)}, ${sqlString(input.color)}, ${sqlString(
      input.icon
    )}, ${sqlString(input.frequency_type)}, ${sqlNumber(input.target_count, 1)}, ${sqlNumber(input.period_interval, 1)}, ${sqlString(
      input.period_unit
    )}, ${sqlJson(input.weekdays ?? null)}, ${sqlString(input.starts_at || timestamp)}, ${sqlString(input.ends_at)}, 1, ${sqlString(
      timestamp
    )}, ${sqlString(timestamp)});
  `);

  if (input.reminder?.is_enabled) {
    upsertReminder(id, {
      is_enabled: true,
      time_of_day: input.reminder.time_of_day,
      weekdays: input.reminder.weekdays ?? input.weekdays ?? null
    });
  }

  return id;
}

export function updateHabit(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    color: string;
    icon: string;
    frequency_type: FrequencyType;
    target_count: number;
    period_interval: number;
    period_unit: PeriodUnit;
    weekdays: number[] | null;
    starts_at: string;
    ends_at: string | null;
    is_active: boolean;
    reminder: {
      is_enabled: boolean;
      time_of_day: string;
      weekdays?: number[] | null;
    };
  }>
) {
  const existing = getHabits().find((habit) => habit.id === id);
  if (!existing) {
    throw new Error("Habit not found");
  }

  const timestamp = nowIso();
  exec(`
    UPDATE habits SET
      title = ${sqlString(input.title ?? existing.title)},
      description = ${sqlString(input.description ?? existing.description)},
      color = ${sqlString(input.color ?? existing.color)},
      icon = ${sqlString(input.icon ?? existing.icon)},
      frequency_type = ${sqlString(input.frequency_type ?? existing.frequency_type)},
      target_count = ${sqlNumber(input.target_count ?? existing.target_count, 1)},
      period_interval = ${sqlNumber(input.period_interval ?? existing.period_interval, 1)},
      period_unit = ${sqlString(input.period_unit ?? existing.period_unit)},
      weekdays = ${sqlJson(input.weekdays === undefined ? existing.weekdays : input.weekdays)},
      starts_at = ${sqlString(input.starts_at ?? existing.starts_at)},
      ends_at = ${sqlString(input.ends_at === undefined ? existing.ends_at : input.ends_at)},
      is_active = ${sqlBoolean(input.is_active ?? existing.is_active)},
      updated_at = ${sqlString(timestamp)}
    WHERE id = ${sqlString(id)} AND user_id = ${sqlString(LOCAL_USER_ID)};
  `);

  if (input.reminder) {
    upsertReminder(id, input.reminder);
  }
}

export function archiveHabit(id: string) {
  updateHabit(id, { is_active: false });
}

export function createEvent(input: {
  id?: string;
  habit_id: string;
  occurred_at?: string;
  value?: number;
  note?: string | null;
  source?: EventSource;
}) {
  const habit = getHabits().find((item) => item.id === input.habit_id);
  if (!habit) {
    throw new Error("Habit not found");
  }

  const timestamp = nowIso();
  const id = input.id || crypto.randomUUID();
  exec(`
    INSERT INTO habit_events (id, habit_id, user_id, occurred_at, value, note, source, created_at, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(input.habit_id)}, ${sqlString(LOCAL_USER_ID)}, ${sqlString(input.occurred_at || timestamp)}, ${sqlNumber(
      input.value ?? 1,
      1
    )}, ${sqlString(input.note)}, ${sqlString(input.source || "manual")}, ${sqlString(timestamp)}, ${sqlString(timestamp)});
  `);
  return id;
}

export function markReminderSent(id: string, sentAt = nowIso()) {
  exec(`UPDATE reminders SET last_sent_at = ${sqlString(sentAt)}, updated_at = ${sqlString(sentAt)} WHERE id = ${sqlString(id)};`);
}

export function deleteEvent(id: string) {
  exec(`DELETE FROM habit_events WHERE id = ${sqlString(id)} AND user_id = ${sqlString(LOCAL_USER_ID)};`);
}

export function upsertReminder(
  habitId: string,
  input: {
    is_enabled: boolean;
    time_of_day: string;
    weekdays?: number[] | null;
    channel?: ReminderChannel;
  }
) {
  const existing = getReminders().find((reminder) => reminder.habit_id === habitId);
  const timestamp = nowIso();

  if (!input.is_enabled) {
    if (existing) {
      exec(`UPDATE reminders SET is_enabled = 0, updated_at = ${sqlString(timestamp)} WHERE id = ${sqlString(existing.id)};`);
    }
    return;
  }

  if (existing) {
    exec(`
      UPDATE reminders SET
        channel = ${sqlString(input.channel || existing.channel)},
        time_of_day = ${sqlString(input.time_of_day)},
        timezone = ${sqlString(DEFAULT_TIMEZONE)},
        weekdays = ${sqlJson(input.weekdays ?? existing.weekdays)},
        is_enabled = 1,
        updated_at = ${sqlString(timestamp)}
      WHERE id = ${sqlString(existing.id)};
    `);
    return;
  }

  exec(`
    INSERT INTO reminders (id, habit_id, user_id, channel, time_of_day, timezone, weekdays, is_enabled, last_sent_at, created_at, updated_at)
    VALUES (${sqlString(crypto.randomUUID())}, ${sqlString(habitId)}, ${sqlString(LOCAL_USER_ID)}, ${sqlString(
      input.channel || "in_app"
    )}, ${sqlString(input.time_of_day)}, ${sqlString(DEFAULT_TIMEZONE)}, ${sqlJson(input.weekdays ?? null)}, 1, NULL, ${sqlString(
      timestamp
    )}, ${sqlString(timestamp)});
  `);
}

export function unlockAchievement(code: string, habitId: string | null) {
  const achievement = getAchievements().find((item) => item.code === code);
  if (!achievement) {
    return null;
  }

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  exec(`
    INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, habit_id, unlocked_at)
    VALUES (${sqlString(id)}, ${sqlString(LOCAL_USER_ID)}, ${sqlString(achievement.id)}, ${sqlString(habitId)}, ${sqlString(timestamp)});
  `);

  return id;
}

export function exportData(): ImportPayload {
  return {
    schema_version: 1,
    exported_at: nowIso(),
    user: {
      timezone: getTimezone()
    },
    habits: getHabits(),
    events: getEvents(),
    reminders: getReminders()
  };
}

export function importData(payload: ImportPayload, dryRun = false) {
  if (payload.schema_version !== 1) {
    throw new Error("Поддерживается только schema_version = 1");
  }

  if (!Array.isArray(payload.habits) || !Array.isArray(payload.events)) {
    throw new Error("Файл должен содержать массивы habits и events");
  }

  const existingHabits = getHabits();
  const errors: string[] = [];
  const habitIdMap = new Map<string, string>();
  let habitsCreated = 0;
  let eventsCreated = 0;
  let remindersCreated = 0;

  for (const habit of payload.habits) {
    if (!habit.title?.trim()) {
      errors.push("Привычка без title пропущена.");
      continue;
    }

    const importedId = habit.id || crypto.randomUUID();
    const existing = existingHabits.find((item) => item.id === importedId);
    const resolvedId = existing ? existing.id : importedId;
    habitIdMap.set(importedId, resolvedId);

    if (!existing) {
      habitsCreated += 1;
      if (!dryRun) {
        createHabit({
          id: importedId,
          title: habit.title,
          description: habit.description ?? null,
          color: habit.color || "#14b8a6",
          icon: habit.icon || "circle-check",
          frequency_type: habit.frequency_type || "daily",
          target_count: habit.target_count || 1,
          period_interval: habit.period_interval || 1,
          period_unit: habit.period_unit || "day",
          weekdays: habit.weekdays ?? null,
          starts_at: habit.starts_at || nowIso(),
          ends_at: habit.ends_at ?? null
        });
      }
    }
  }

  const refreshedHabits = dryRun ? existingHabits : getHabits();

  for (const event of payload.events) {
    const idExists = event.id && getEvents().some((item) => item.id === event.id);
    if (idExists) {
      continue;
    }

    let habitId = event.habit_id ? habitIdMap.get(event.habit_id) || event.habit_id : null;
    if (!habitId && event.habit_title) {
      const matches = refreshedHabits.filter((habit) => habit.title === event.habit_title);
      if (matches.length === 1) {
        habitId = matches[0].id;
      } else {
        errors.push(`Событие ${event.occurred_at}: не найдено однозначное совпадение habit_title.`);
        continue;
      }
    }

    if (!habitId || !refreshedHabits.some((habit) => habit.id === habitId)) {
      errors.push(`Событие ${event.occurred_at}: habit_id не найден.`);
      continue;
    }

    eventsCreated += 1;
    if (!dryRun) {
      createEvent({
        id: event.id || crypto.randomUUID(),
        habit_id: habitId,
        occurred_at: event.occurred_at,
        value: event.value || 1,
        note: event.note ?? null,
        source: "import"
      });
    }
  }

  for (const reminder of payload.reminders || []) {
    let habitId = reminder.habit_id ? habitIdMap.get(reminder.habit_id) || reminder.habit_id : null;
    if (!habitId && reminder.habit_title) {
      habitId = refreshedHabits.find((habit) => habit.title === reminder.habit_title)?.id || null;
    }

    if (!habitId) {
      errors.push(`Напоминание ${reminder.time_of_day || ""}: привычка не найдена.`);
      continue;
    }

    remindersCreated += 1;
    if (!dryRun) {
      upsertReminder(habitId, {
        is_enabled: reminder.is_enabled ?? true,
        time_of_day: reminder.time_of_day || "09:00",
        weekdays: reminder.weekdays ?? null,
        channel: reminder.channel || "in_app"
      });
    }
  }

  return {
    habitsCreated,
    eventsCreated,
    remindersCreated,
    errors
  };
}
