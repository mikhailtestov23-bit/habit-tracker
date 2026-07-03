import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
  UnlockedAchievement
} from "@/lib/types";
import { DEFAULT_TIMEZONE, LOCAL_USER_ID } from "@/lib/dbLocal";
import { nowIso } from "@/lib/time";

type DbRow = Record<string, unknown>;

let supabaseClient: SupabaseClient | null = null;
let bootstrapped = false;

const achievementSeeds = [
  ["first_checkin", "Первый шаг", "Первая отмеченная привычка.", "sparkles", "common", "event_count", 1],
  ["three_day_streak", "Три дня подряд", "Привычка выполнена 3 дня подряд.", "flame", "rare", "streak", 3],
  ["seven_day_streak", "Неделя в огне", "Семь дней уверенного ритма.", "trophy", "epic", "streak", 7],
  ["perfect_week", "Идеальная неделя", "Все активные привычки закрыты в текущей неделе.", "crown", "legendary", "perfect_week", 1],
  ["comeback", "Возвращение", "Привычка выполнена после паузы 7+ дней.", "rotate", "rare", "gap", 7],
  ["hundred_events", "Мастер ритма", "100 выполнений одной привычки.", "badge", "legendary", "habit_event_count", 100]
] as const;

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

function supabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();

  if (!url || !key) {
    throw new Error("Supabase backend is selected, but SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are not configured.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClient;
}

function fail(error: unknown) {
  if (error) {
    throw new Error(error instanceof Error ? error.message : JSON.stringify(error));
  }
}

function normalizeWeekdays(value: unknown): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(Number).filter((day) => day >= 1 && day <= 7);
  }

  if (typeof value === "string") {
    try {
      return normalizeWeekdays(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function normalizeTime(value: unknown) {
  const text = String(value || "09:00");
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function mapHabit(row: DbRow): Habit {
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
    weekdays: normalizeWeekdays(row.weekdays),
    starts_at: String(row.starts_at),
    ends_at: row.ends_at ? String(row.ends_at) : null,
    is_active: normalizeBoolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapEvent(row: DbRow): HabitEvent {
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

function mapReminder(row: DbRow): Reminder {
  return {
    id: String(row.id),
    habit_id: String(row.habit_id),
    user_id: String(row.user_id),
    channel: String(row.channel) as ReminderChannel,
    time_of_day: normalizeTime(row.time_of_day),
    timezone: String(row.timezone),
    weekdays: normalizeWeekdays(row.weekdays),
    is_enabled: normalizeBoolean(row.is_enabled),
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapAchievement(row: DbRow): Achievement {
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

async function ensureSupabaseBootstrap() {
  if (bootstrapped) {
    return;
  }

  const client = supabase();
  const timestamp = nowIso();

  fail(
    (
      await client.from("users").upsert(
        {
          id: LOCAL_USER_ID,
          email: null,
          name: "Local user",
          timezone: DEFAULT_TIMEZONE,
          created_at: timestamp,
          updated_at: timestamp
        },
        { onConflict: "id" }
      )
    ).error
  );

  for (const [code, title, description, icon, rarity, conditionType, conditionValue] of achievementSeeds) {
    const { data: existing, error: existingError } = await client.from("achievements").select("id").eq("code", code).maybeSingle();
    fail(existingError);

    if (existing?.id) {
      fail(
        (
          await client
            .from("achievements")
            .update({
              title,
              description,
              icon,
              rarity,
              condition_type: conditionType,
              condition_value: conditionValue
            })
            .eq("id", existing.id)
        ).error
      );
    } else {
      fail(
        (
          await client.from("achievements").insert({
            id: crypto.randomUUID(),
            code,
            title,
            description,
            icon,
            rarity,
            condition_type: conditionType,
            condition_value: conditionValue,
            created_at: timestamp
          })
        ).error
      );
    }
  }

  const { data: existingHabits, error: habitsError } = await client.from("habits").select("id").eq("user_id", LOCAL_USER_ID).limit(1);
  fail(habitsError);

  if (!existingHabits?.length) {
    const waterId = crypto.randomUUID();
    const readingId = crypto.randomUUID();

    fail(
      (
        await client.from("habits").insert([
          {
            id: waterId,
            user_id: LOCAL_USER_ID,
            title: "Вода утром",
            description: "Стакан воды после пробуждения.",
            color: "#0ea5e9",
            icon: "droplet",
            frequency_type: "daily",
            target_count: 1,
            period_interval: 1,
            period_unit: "day",
            weekdays: null,
            starts_at: timestamp,
            ends_at: null,
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp
          },
          {
            id: readingId,
            user_id: LOCAL_USER_ID,
            title: "Чтение",
            description: "Минимум одна сессия чтения.",
            color: "#f97316",
            icon: "book-open",
            frequency_type: "weekly",
            target_count: 3,
            period_interval: 1,
            period_unit: "week",
            weekdays: null,
            starts_at: timestamp,
            ends_at: null,
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp
          }
        ])
      ).error
    );

    fail(
      (
        await client.from("reminders").insert({
          id: crypto.randomUUID(),
          habit_id: waterId,
          user_id: LOCAL_USER_ID,
          channel: "in_app",
          time_of_day: "09:00",
          timezone: DEFAULT_TIMEZONE,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          is_enabled: true,
          last_sent_at: null,
          created_at: timestamp,
          updated_at: timestamp
        })
      ).error
    );
  }

  bootstrapped = true;
}

export async function getTimezone() {
  await ensureSupabaseBootstrap();
  const { data, error } = await supabase().from("users").select("timezone").eq("id", LOCAL_USER_ID).maybeSingle();
  fail(error);
  return data?.timezone || DEFAULT_TIMEZONE;
}

export async function getHabits() {
  await ensureSupabaseBootstrap();
  const { data, error } = await supabase()
    .from("habits")
    .select("*")
    .eq("user_id", LOCAL_USER_ID)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  fail(error);
  return (data || []).map(mapHabit);
}

export async function getEvents() {
  await ensureSupabaseBootstrap();
  const { data, error } = await supabase().from("habit_events").select("*").eq("user_id", LOCAL_USER_ID).order("occurred_at", { ascending: false });
  fail(error);
  return (data || []).map(mapEvent);
}

export async function getReminders() {
  await ensureSupabaseBootstrap();
  const { data, error } = await supabase().from("reminders").select("*").eq("user_id", LOCAL_USER_ID).order("time_of_day", { ascending: true });
  fail(error);
  return (data || []).map(mapReminder);
}

export async function getAchievements() {
  await ensureSupabaseBootstrap();
  const { data, error } = await supabase().from("achievements").select("*").order("condition_value", { ascending: true });
  fail(error);
  return (data || []).map(mapAchievement);
}

export async function getUnlockedAchievements() {
  await ensureSupabaseBootstrap();
  const [{ data: rows, error }, achievements, habits] = await Promise.all([
    supabase().from("user_achievements").select("*").eq("user_id", LOCAL_USER_ID).order("unlocked_at", { ascending: false }),
    getAchievements(),
    getHabits()
  ]);
  fail(error);

  return (rows || []).flatMap((row): UnlockedAchievement[] => {
    const achievement = achievements.find((item) => item.id === row.achievement_id);
    if (!achievement) {
      return [];
    }

    return [
      {
        id: String(row.id),
        user_id: String(row.user_id),
        achievement_id: String(row.achievement_id),
        habit_id: row.habit_id ? String(row.habit_id) : null,
        unlocked_at: String(row.unlocked_at),
        habit_title: habits.find((habit) => habit.id === row.habit_id)?.title || null,
        achievement
      }
    ];
  });
}

export async function createHabit(input: {
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
  await ensureSupabaseBootstrap();
  const timestamp = nowIso();
  const id = input.id || crypto.randomUUID();

  fail(
    (
      await supabase().from("habits").insert({
        id,
        user_id: LOCAL_USER_ID,
        title: input.title,
        description: input.description ?? null,
        color: input.color,
        icon: input.icon,
        frequency_type: input.frequency_type,
        target_count: input.target_count,
        period_interval: input.period_interval,
        period_unit: input.period_unit,
        weekdays: input.weekdays ?? null,
        starts_at: input.starts_at || timestamp,
        ends_at: input.ends_at ?? null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp
      })
    ).error
  );

  if (input.reminder?.is_enabled) {
    await upsertReminder(id, {
      is_enabled: true,
      time_of_day: input.reminder.time_of_day,
      weekdays: input.reminder.weekdays ?? input.weekdays ?? null
    });
  }

  return id;
}

export async function updateHabit(
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
  const existing = (await getHabits()).find((habit) => habit.id === id);
  if (!existing) {
    throw new Error("Habit not found");
  }

  const timestamp = nowIso();
  fail(
    (
      await supabase()
        .from("habits")
        .update({
          title: input.title ?? existing.title,
          description: input.description ?? existing.description,
          color: input.color ?? existing.color,
          icon: input.icon ?? existing.icon,
          frequency_type: input.frequency_type ?? existing.frequency_type,
          target_count: input.target_count ?? existing.target_count,
          period_interval: input.period_interval ?? existing.period_interval,
          period_unit: input.period_unit ?? existing.period_unit,
          weekdays: input.weekdays === undefined ? existing.weekdays : input.weekdays,
          starts_at: input.starts_at ?? existing.starts_at,
          ends_at: input.ends_at === undefined ? existing.ends_at : input.ends_at,
          is_active: input.is_active ?? existing.is_active,
          updated_at: timestamp
        })
        .eq("id", id)
        .eq("user_id", LOCAL_USER_ID)
    ).error
  );

  if (input.reminder) {
    await upsertReminder(id, input.reminder);
  }
}

export async function archiveHabit(id: string) {
  await updateHabit(id, { is_active: false });
}

export async function createEvent(input: {
  id?: string;
  habit_id: string;
  occurred_at?: string;
  value?: number;
  note?: string | null;
  source?: EventSource;
}) {
  const habit = (await getHabits()).find((item) => item.id === input.habit_id);
  if (!habit) {
    throw new Error("Habit not found");
  }

  const timestamp = nowIso();
  const id = input.id || crypto.randomUUID();
  fail(
    (
      await supabase().from("habit_events").insert({
        id,
        habit_id: input.habit_id,
        user_id: LOCAL_USER_ID,
        occurred_at: input.occurred_at || timestamp,
        value: input.value ?? 1,
        note: input.note ?? null,
        source: input.source || "manual",
        created_at: timestamp,
        updated_at: timestamp
      })
    ).error
  );
  return id;
}

export async function deleteEvent(id: string) {
  await ensureSupabaseBootstrap();
  fail((await supabase().from("habit_events").delete().eq("id", id).eq("user_id", LOCAL_USER_ID)).error);
}

export async function upsertReminder(
  habitId: string,
  input: {
    is_enabled: boolean;
    time_of_day: string;
    weekdays?: number[] | null;
    channel?: ReminderChannel;
  }
) {
  await ensureSupabaseBootstrap();
  const existing = (await getReminders()).find((reminder) => reminder.habit_id === habitId);
  const timestamp = nowIso();

  if (!input.is_enabled) {
    if (existing) {
      fail((await supabase().from("reminders").update({ is_enabled: false, updated_at: timestamp }).eq("id", existing.id)).error);
    }
    return;
  }

  if (existing) {
    fail(
      (
        await supabase()
          .from("reminders")
          .update({
            channel: input.channel || existing.channel,
            time_of_day: input.time_of_day,
            timezone: await getTimezone(),
            weekdays: input.weekdays ?? existing.weekdays,
            is_enabled: true,
            updated_at: timestamp
          })
          .eq("id", existing.id)
      ).error
    );
    return;
  }

  fail(
    (
      await supabase().from("reminders").insert({
        id: crypto.randomUUID(),
        habit_id: habitId,
        user_id: LOCAL_USER_ID,
        channel: input.channel || "in_app",
        time_of_day: input.time_of_day,
        timezone: await getTimezone(),
        weekdays: input.weekdays ?? null,
        is_enabled: true,
        last_sent_at: null,
        created_at: timestamp,
        updated_at: timestamp
      })
    ).error
  );
}

export async function markReminderSent(id: string, sentAt = nowIso()) {
  await ensureSupabaseBootstrap();
  fail((await supabase().from("reminders").update({ last_sent_at: sentAt, updated_at: sentAt }).eq("id", id)).error);
}

export async function unlockAchievement(code: string, habitId: string | null) {
  await ensureSupabaseBootstrap();
  const achievement = (await getAchievements()).find((item) => item.code === code);
  if (!achievement) {
    return null;
  }

  let existingQuery = supabase().from("user_achievements").select("id").eq("user_id", LOCAL_USER_ID).eq("achievement_id", achievement.id);
  existingQuery = habitId ? existingQuery.eq("habit_id", habitId) : existingQuery.is("habit_id", null);
  const { data: existing, error: existingError } = await existingQuery.limit(1);
  fail(existingError);

  if (existing?.length) {
    return null;
  }

  const id = crypto.randomUUID();
  fail(
    (
      await supabase().from("user_achievements").insert({
        id,
        user_id: LOCAL_USER_ID,
        achievement_id: achievement.id,
        habit_id: habitId,
        unlocked_at: nowIso()
      })
    ).error
  );
  return id;
}

export async function exportData(): Promise<ImportPayload> {
  return {
    schema_version: 1,
    exported_at: nowIso(),
    user: {
      timezone: await getTimezone()
    },
    habits: await getHabits(),
    events: await getEvents(),
    reminders: await getReminders()
  };
}

export async function importData(payload: ImportPayload, dryRun = false) {
  if (payload.schema_version !== 1) {
    throw new Error("Поддерживается только schema_version = 1");
  }

  if (!Array.isArray(payload.habits) || !Array.isArray(payload.events)) {
    throw new Error("Файл должен содержать массивы habits и events");
  }

  const existingHabits = await getHabits();
  const existingEvents = await getEvents();
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
        await createHabit({
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

  const refreshedHabits = dryRun ? existingHabits : await getHabits();

  for (const event of payload.events) {
    const idExists = event.id && existingEvents.some((item) => item.id === event.id);
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
      await createEvent({
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
      await upsertReminder(habitId, {
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
