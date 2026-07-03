import { getEvents, getHabits, getReminders, getTimezone, unlockAchievement } from "@/lib/db";
import { getGapBeforeEvent, getHabitProgress, getHabitStreak, isPerfectCurrentWeek } from "@/lib/habitLogic";

export async function evaluateAchievementsForEvent(habitId: string, occurredAt: string) {
  const [timezone, habits, events, reminders] = await Promise.all([getTimezone(), getHabits(), getEvents(), getReminders()]);
  const unlocked: string[] = [];

  if (events.length >= 1 && (await unlockAchievement("first_checkin", null))) {
    unlocked.push("first_checkin");
  }

  const habit = habits.find((item) => item.id === habitId);
  if (habit) {
    const streak = getHabitStreak(habit, events, timezone);
    if (streak >= 3 && (await unlockAchievement("three_day_streak", habit.id))) {
      unlocked.push("three_day_streak");
    }
    if (streak >= 7 && (await unlockAchievement("seven_day_streak", habit.id))) {
      unlocked.push("seven_day_streak");
    }

    const habitEventCount = events.filter((event) => event.habit_id === habit.id).length;
    if (habitEventCount >= 100 && (await unlockAchievement("hundred_events", habit.id))) {
      unlocked.push("hundred_events");
    }

    const gap = getGapBeforeEvent(habit.id, events, occurredAt, timezone);
    if (gap !== null && gap >= 7 && (await unlockAchievement("comeback", habit.id))) {
      unlocked.push("comeback");
    }
  }

  const progressItems = habits.map((item) => getHabitProgress(item, events, reminders, timezone));
  if (isPerfectCurrentWeek(progressItems) && (await unlockAchievement("perfect_week", null))) {
    unlocked.push("perfect_week");
  }

  return unlocked;
}
