import { getAchievements, getEvents, getHabits, getReminders, getTimezone, getUnlockedAchievements } from "@/lib/db";
import { getHabitProgress } from "@/lib/habitLogic";
import { TrackerState } from "@/lib/types";
import { nowIso } from "@/lib/time";

export async function getTrackerState(): Promise<TrackerState> {
  const [timezone, habits, events, reminders, achievements, achievementCatalog] = await Promise.all([
    getTimezone(),
    getHabits(),
    getEvents(),
    getReminders(),
    getUnlockedAchievements(),
    getAchievements()
  ]);
  const progress = habits.map((habit) => getHabitProgress(habit, events, reminders, timezone));

  return {
    generated_at: nowIso(),
    timezone,
    habits: progress,
    events,
    achievements,
    achievement_catalog: achievementCatalog,
    totals: {
      active_habits: progress.filter((item) => item.habit.is_active).length,
      completed_now: progress.filter((item) => item.habit.is_active && item.is_complete).length,
      events: events.length,
      best_streak: Math.max(0, ...progress.map((item) => item.streak))
    }
  };
}
