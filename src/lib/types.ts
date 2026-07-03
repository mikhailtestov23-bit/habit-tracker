export type FrequencyType = "hourly" | "daily" | "weekly" | "custom";
export type PeriodUnit = "hour" | "day" | "week";
export type EventSource = "manual" | "import" | "reminder" | "automation";
export type ReminderChannel = "push" | "email" | "in_app";
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type Habit = {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
};

export type HabitEvent = {
  id: string;
  habit_id: string;
  user_id: string;
  occurred_at: string;
  value: number;
  note: string | null;
  source: EventSource;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  habit_id: string;
  user_id: string;
  channel: ReminderChannel;
  time_of_day: string;
  timezone: string;
  weekdays: number[] | null;
  is_enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  condition_type: string;
  condition_value: number;
  created_at: string;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_id: string;
  habit_id: string | null;
  unlocked_at: string;
};

export type UnlockedAchievement = UserAchievement & {
  achievement: Achievement;
  habit_title: string | null;
};

export type UserProfile = {
  id: string;
  email: string | null;
  name: string;
  timezone: string;
};

export type HabitProgress = {
  habit: Habit;
  progress: number;
  target: number;
  percentage: number;
  is_complete: boolean;
  period_label: string;
  streak: number;
  recent_days: Array<{
    date: string;
    value: number;
    complete: boolean;
  }>;
  events: HabitEvent[];
  reminder: Reminder | null;
};

export type TrackerState = {
  generated_at: string;
  user: UserProfile;
  timezone: string;
  habits: HabitProgress[];
  events: HabitEvent[];
  achievements: UnlockedAchievement[];
  achievement_catalog: Achievement[];
  social: SocialState;
  totals: {
    active_habits: number;
    completed_now: number;
    events: number;
    best_streak: number;
  };
};

export type SocialMember = {
  user_id: string;
  name: string;
  email: string | null;
  active_habits: number;
  completed_now: number;
  events: number;
  best_streak: number;
  score: number;
};

export type HabitLeaderboardEntry = {
  user_id: string;
  name: string;
  habit_id: string;
  progress: number;
  target: number;
  percentage: number;
  streak: number;
  events: number;
  is_complete: boolean;
  color: string;
  icon: string;
};

export type HabitLeaderboard = {
  habit_key: string;
  title: string;
  entries: HabitLeaderboardEntry[];
};

export type SocialState = {
  members: SocialMember[];
  habit_leaderboards: HabitLeaderboard[];
};

export type SocialSnapshot = {
  users: UserProfile[];
  habits: Habit[];
  events: HabitEvent[];
  reminders: Reminder[];
};

export type ImportPayload = {
  schema_version: number;
  exported_at?: string;
  user?: {
    timezone?: string;
  };
  habits: Array<Partial<Habit> & { title: string }>;
  events: Array<Partial<HabitEvent> & { occurred_at: string; habit_title?: string }>;
  reminders?: Array<Partial<Reminder> & { habit_title?: string }>;
};
