import { getAchievements, getEvents, getHabits, getReminders, getSocialSnapshot, getTimezone, getUnlockedAchievements, getUserProfile } from "@/lib/db";
import { getHabitProgress } from "@/lib/habitLogic";
import { HabitLeaderboard, SocialState, TrackerState } from "@/lib/types";
import { nowIso } from "@/lib/time";

function habitKey(title: string) {
  return title.trim().toLocaleLowerCase("ru-RU");
}

function buildSocialState(snapshot: Awaited<ReturnType<typeof getSocialSnapshot>>): SocialState {
  const members = snapshot.users
    .map((user) => {
      const habits = snapshot.habits.filter((habit) => habit.user_id === user.id);
      const events = snapshot.events.filter((event) => event.user_id === user.id);
      const reminders = snapshot.reminders.filter((reminder) => reminder.user_id === user.id);
      const progress = habits.map((habit) => getHabitProgress(habit, events, reminders, user.timezone));

      return {
        user_id: user.id,
        name: user.name,
        email: user.email,
        active_habits: progress.filter((item) => item.habit.is_active).length,
        completed_now: progress.filter((item) => item.habit.is_active && item.is_complete).length,
        events: events.length,
        best_streak: Math.max(0, ...progress.map((item) => item.streak)),
        score: events.length + progress.reduce((total, item) => total + item.streak * 3 + (item.is_complete ? 5 : 0), 0)
      };
    })
    .sort((a, b) => b.score - a.score || b.events - a.events || a.name.localeCompare(b.name, "ru-RU"));

  const leaderboardsByHabit = new Map<string, HabitLeaderboard>();

  for (const habit of snapshot.habits.filter((item) => item.is_active)) {
    const user = snapshot.users.find((item) => item.id === habit.user_id);
    if (!user) {
      continue;
    }

    const events = snapshot.events.filter((event) => event.user_id === user.id);
    const reminders = snapshot.reminders.filter((reminder) => reminder.user_id === user.id);
    const progress = getHabitProgress(habit, events, reminders, user.timezone);
    const key = habitKey(habit.title);
    const leaderboard = leaderboardsByHabit.get(key) || {
      habit_key: key,
      title: habit.title,
      entries: []
    };

    leaderboard.entries.push({
      user_id: user.id,
      name: user.name,
      habit_id: habit.id,
      progress: progress.progress,
      target: progress.target,
      percentage: progress.percentage,
      streak: progress.streak,
      events: events.filter((event) => event.habit_id === habit.id).length,
      is_complete: progress.is_complete,
      color: habit.color,
      icon: habit.icon
    });
    leaderboardsByHabit.set(key, leaderboard);
  }

  const habit_leaderboards = [...leaderboardsByHabit.values()]
    .map((leaderboard) => ({
      ...leaderboard,
      entries: leaderboard.entries.sort((a, b) => b.percentage - a.percentage || b.progress - a.progress || b.streak - a.streak || a.name.localeCompare(b.name, "ru-RU"))
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.title.localeCompare(b.title, "ru-RU"));

  return {
    members,
    habit_leaderboards
  };
}

export async function getTrackerState(): Promise<TrackerState> {
  const [user, timezone, habits, events, reminders, achievements, achievementCatalog, socialSnapshot] = await Promise.all([
    getUserProfile(),
    getTimezone(),
    getHabits(),
    getEvents(),
    getReminders(),
    getUnlockedAchievements(),
    getAchievements(),
    getSocialSnapshot()
  ]);
  const progress = habits.map((habit) => getHabitProgress(habit, events, reminders, timezone));

  return {
    generated_at: nowIso(),
    user,
    timezone,
    habits: progress,
    events,
    achievements,
    achievement_catalog: achievementCatalog,
    social: buildSocialState(socialSnapshot),
    totals: {
      active_habits: progress.filter((item) => item.habit.is_active).length,
      completed_now: progress.filter((item) => item.habit.is_active && item.is_complete).length,
      events: events.length,
      best_streak: Math.max(0, ...progress.map((item) => item.streak))
    }
  };
}
