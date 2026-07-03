import {
  getDateKeyDifference,
  getHourlyWindow,
  getLocalDateKey,
  getLocalWeekday,
  getRecentDateKeys,
  getWeekKey
} from "@/lib/time";
import { Habit, HabitEvent, HabitProgress, Reminder } from "@/lib/types";

function sumEvents(events: HabitEvent[]) {
  return events.reduce((total, event) => total + Number(event.value || 0), 0);
}

function eventsForHabit(habit: Habit, events: HabitEvent[]) {
  return events.filter((event) => event.habit_id === habit.id);
}

function eventValueForDay(events: HabitEvent[], dateKey: string, timezone: string) {
  return sumEvents(events.filter((event) => getLocalDateKey(event.occurred_at, timezone) === dateKey));
}

function eventValueForWeek(events: HabitEvent[], weekKey: string, timezone: string) {
  return sumEvents(events.filter((event) => getWeekKey(event.occurred_at, timezone) === weekKey));
}

export function isHabitScheduledToday(habit: Habit, timezone: string, now = new Date()) {
  if (!habit.is_active) {
    return false;
  }

  if (habit.ends_at && new Date(habit.ends_at).getTime() < now.getTime()) {
    return false;
  }

  if (habit.frequency_type === "custom" && habit.weekdays?.length) {
    return habit.weekdays.includes(getLocalWeekday(now, timezone));
  }

  return true;
}

export function getHabitStreak(habit: Habit, events: HabitEvent[], timezone: string, now = new Date()) {
  const habitEvents = eventsForHabit(habit, events);

  if (habit.frequency_type === "weekly") {
    let streak = 0;
    let cursor = getWeekKey(now, timezone);

    for (let index = 0; index < 52; index += 1) {
      const value = eventValueForWeek(habitEvents, cursor, timezone);
      if (value < habit.target_count) {
        break;
      }

      streak += 1;
      const cursorDate = new Date(`${cursor}T00:00:00.000Z`);
      cursorDate.setUTCDate(cursorDate.getUTCDate() - 7);
      cursor = cursorDate.toISOString().slice(0, 10);
    }

    return streak;
  }

  let streak = 0;
  let cursor = getLocalDateKey(now, timezone);

  for (let index = 0; index < 370; index += 1) {
    if (habit.frequency_type === "custom" && habit.weekdays?.length) {
      const weekday = getLocalWeekday(`${cursor}T12:00:00.000Z`, "UTC");
      if (!habit.weekdays.includes(weekday)) {
        const date = new Date(`${cursor}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() - 1);
        cursor = date.toISOString().slice(0, 10);
        continue;
      }
    }

    const value = eventValueForDay(habitEvents, cursor, timezone);
    if (value < habit.target_count) {
      break;
    }

    streak += 1;
    const date = new Date(`${cursor}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    cursor = date.toISOString().slice(0, 10);
  }

  return streak;
}

export function getHabitProgress(
  habit: Habit,
  allEvents: HabitEvent[],
  reminders: Reminder[],
  timezone: string,
  now = new Date()
): HabitProgress {
  const habitEvents = eventsForHabit(habit, allEvents).sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  let progress = 0;
  let periodLabel = "Сегодня";

  if (habit.frequency_type === "hourly") {
    const window = getHourlyWindow(habit.starts_at, habit.period_interval, now);
    progress = sumEvents(
      habitEvents.filter((event) => {
        const occurredAt = new Date(event.occurred_at).getTime();
        return occurredAt >= window.start.getTime() && occurredAt < window.end.getTime();
      })
    );
    periodLabel = `${window.start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} - ${window.end.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } else if (habit.frequency_type === "weekly") {
    const weekKey = getWeekKey(now, timezone);
    progress = eventValueForWeek(habitEvents, weekKey, timezone);
    periodLabel = "Эта неделя";
  } else {
    const today = getLocalDateKey(now, timezone);
    progress = eventValueForDay(habitEvents, today, timezone);
    periodLabel = habit.frequency_type === "custom" ? "Ближайший день" : "Сегодня";
  }

  const target = Math.max(habit.target_count, 1);
  const recentDays = getRecentDateKeys(21, timezone, now).map((date) => {
    const value = eventValueForDay(habitEvents, date, timezone);
    return {
      date,
      value,
      complete: value >= target
    };
  });

  return {
    habit,
    progress,
    target,
    percentage: Math.min(Math.round((progress / target) * 100), 100),
    is_complete: progress >= target,
    period_label: periodLabel,
    streak: getHabitStreak(habit, allEvents, timezone, now),
    recent_days: recentDays,
    events: habitEvents.slice(0, 12),
    reminder: reminders.find((reminder) => reminder.habit_id === habit.id) || null
  };
}

export function getGapBeforeEvent(habitId: string, events: HabitEvent[], occurredAt: string, timezone: string) {
  const currentDay = getLocalDateKey(occurredAt, timezone);
  const previousDays = events
    .filter((event) => event.habit_id === habitId && new Date(event.occurred_at).getTime() < new Date(occurredAt).getTime())
    .map((event) => getLocalDateKey(event.occurred_at, timezone))
    .sort();

  const previousDay = previousDays.at(-1);
  if (!previousDay) {
    return null;
  }

  return getDateKeyDifference(currentDay, previousDay);
}

export function isPerfectCurrentWeek(progressItems: HabitProgress[]) {
  const active = progressItems.filter((item) => item.habit.is_active);
  return active.length > 0 && active.every((item) => item.is_complete);
}
