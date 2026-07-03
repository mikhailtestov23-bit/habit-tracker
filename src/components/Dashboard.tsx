"use client";

import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  Check,
  CircleCheck,
  Copy,
  Crown,
  Download,
  Droplet,
  Dumbbell,
  Flame,
  Import,
  Leaf,
  LogIn,
  LogOut,
  Mail,
  Medal,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { FrequencyType, Habit, HabitProgress, PeriodUnit, TrackerState, UnlockedAchievement } from "@/lib/types";
import { getSupabaseBrowserClient, hasBrowserSupabaseConfig } from "@/lib/supabaseBrowser";

type HabitForm = {
  id?: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  frequency_type: FrequencyType;
  target_count: number;
  period_interval: number;
  period_unit: PeriodUnit;
  weekdays: number[];
  reminder_enabled: boolean;
  reminder_time: string;
};

type ImportPreview = {
  habitsCreated: number;
  eventsCreated: number;
  remindersCreated: number;
  errors: string[];
};

type AuthMode = "sign-in" | "sign-up";

const iconMap = {
  "circle-check": CircleCheck,
  droplet: Droplet,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  leaf: Leaf,
  moon: Moon,
  flame: Flame,
  sparkles: Sparkles,
  trophy: Trophy,
  crown: Crown,
  rotate: RotateCcw,
  badge: BadgeCheck
};

const iconOptions = [
  ["circle-check", "Общее"],
  ["droplet", "Вода"],
  ["book-open", "Чтение"],
  ["dumbbell", "Спорт"],
  ["leaf", "Здоровье"],
  ["moon", "Сон"],
  ["flame", "Фокус"]
];

const colorOptions = ["#0ea5e9", "#14b8a6", "#f97316", "#e11d48", "#7c3aed", "#84cc16", "#111827"];
const weekdays = [
  [1, "Пн"],
  [2, "Вт"],
  [3, "Ср"],
  [4, "Чт"],
  [5, "Пт"],
  [6, "Сб"],
  [7, "Вс"]
] as const;

const defaultForm: HabitForm = {
  title: "",
  description: "",
  color: "#14b8a6",
  icon: "circle-check",
  frequency_type: "daily",
  target_count: 1,
  period_interval: 1,
  period_unit: "day",
  weekdays: [],
  reminder_enabled: false,
  reminder_time: "09:00"
};

function IconByName({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = iconMap[name as keyof typeof iconMap] || CircleCheck;
  return <Icon size={size} strokeWidth={2} />;
}

function formatFrequency(habit: Habit) {
  if (habit.frequency_type === "hourly") {
    return `каждые ${habit.period_interval} ч.`;
  }

  if (habit.frequency_type === "weekly") {
    return `${habit.target_count} в неделю`;
  }

  if (habit.frequency_type === "custom" && habit.weekdays?.length) {
    return habit.weekdays.map((day) => weekdays.find(([value]) => value === day)?.[1]).join(", ");
  }

  return habit.target_count > 1 ? `${habit.target_count} в день` : "ежедневно";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getPeriodUnit(frequency: FrequencyType): PeriodUnit {
  if (frequency === "hourly") {
    return "hour";
  }
  if (frequency === "weekly") {
    return "week";
  }
  return "day";
}

function getHabitKey(title: string) {
  return title.trim().toLocaleLowerCase("ru-RU");
}

function formFromHabit(progress: HabitProgress): HabitForm {
  return {
    id: progress.habit.id,
    title: progress.habit.title,
    description: progress.habit.description || "",
    color: progress.habit.color,
    icon: progress.habit.icon,
    frequency_type: progress.habit.frequency_type,
    target_count: progress.habit.target_count,
    period_interval: progress.habit.period_interval,
    period_unit: progress.habit.period_unit,
    weekdays: progress.habit.weekdays || [],
    reminder_enabled: Boolean(progress.reminder?.is_enabled),
    reminder_time: progress.reminder?.time_of_day || "09:00"
  };
}

export function Dashboard() {
  const authClient = useMemo(() => (hasBrowserSupabaseConfig() ? getSupabaseBrowserClient() : null), []);
  const [state, setState] = useState<TrackerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(!authClient);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [form, setForm] = useState<HabitForm>(defaultForm);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"json" | "csv">("json");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [achievementModal, setAchievementModal] = useState<UnlockedAchievement | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(async (sessionOverride?: Session | null) => {
    if (!authClient) {
      return {};
    }

    const token = sessionOverride?.access_token || (await authClient.auth.getSession()).data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [authClient]);

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}, sessionOverride?: Session | null) => {
    const headers = new Headers(init.headers);
    const auth = await authHeaders(sessionOverride);

    for (const [key, value] of Object.entries(auth)) {
      headers.set(key, value);
    }

    const response = await fetch(path, { ...init, headers });
    if (response.status === 401) {
      setState(null);
      setSession(null);
      setAuthMessage("Войдите в аккаунт, чтобы продолжить.");
    }

    return response;
  }, [authHeaders]);

  const loadState = useCallback(async (sessionOverride?: Session | null) => {
    setLoading(true);
    const response = await apiFetch("/api/state", { cache: "no-store" }, sessionOverride);
    if (!response.ok) {
      setLoading(false);
      return;
    }

    const nextState = (await response.json()) as TrackerState;
    setState(nextState);
    setSelectedHabitId((current) => current || nextState.habits[0]?.habit.id || null);
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    let mounted = true;

    if (!authClient) {
      setAuthReady(true);
      void loadState(null);
      return () => {
        mounted = false;
      };
    }

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setAuthReady(true);
      if (data.session) {
        void loadState(data.session);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setState(null);
      setSelectedHabitId(null);
      if (nextSession) {
        void loadState(nextSession);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [authClient, loadState]);

  const selectedHabit = useMemo(
    () => state?.habits.find((item) => item.habit.id === selectedHabitId) || state?.habits[0] || null,
    [selectedHabitId, state]
  );
  const selectedLeaderboard = selectedHabit
    ? state?.social.habit_leaderboards.find((leaderboard) => leaderboard.habit_key === getHabitKey(selectedHabit.habit.title))
    : null;

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authClient) {
      return;
    }

    setBusy(true);
    setAuthMessage("");

    const credentials = {
      email: authEmail.trim(),
      password: authPassword
    };

    const { data, error } =
      authMode === "sign-up"
        ? await authClient.auth.signUp({
            ...credentials,
            options: {
              data: {
                name: authName.trim() || authEmail.split("@")[0]
              }
            }
          })
        : await authClient.auth.signInWithPassword(credentials);

    if (error) {
      setAuthMessage(error.message);
    } else if (data.session) {
      setSession(data.session);
      await loadState(data.session);
    } else {
      setAuthMessage("Аккаунт создан. Проверьте почту и подтвердите вход.");
    }

    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    await authClient?.auth.signOut();
    setSession(null);
    setState(null);
    setSelectedHabitId(null);
    setBusy(false);
  }

  async function copyInviteLink() {
    const inviteUrl = window.location.origin;
    await navigator.clipboard?.writeText(inviteUrl);
    setReminderMessage("Ссылка приглашения скопирована.");
  }

  async function submitHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      color: form.color,
      icon: form.icon,
      frequency_type: form.frequency_type,
      target_count: Number(form.target_count),
      period_interval: Number(form.period_interval),
      period_unit: form.period_unit,
      weekdays: form.frequency_type === "custom" ? form.weekdays : null,
      reminder: {
        is_enabled: form.reminder_enabled,
        time_of_day: form.reminder_time,
        weekdays: form.frequency_type === "custom" ? form.weekdays : null
      }
    };

    const response = await apiFetch(form.id ? `/api/habits/${form.id}` : "/api/habits", {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    setState((await response.json()) as TrackerState);
    setForm(defaultForm);
    setBusy(false);
  }

  async function checkIn(habitId: string) {
    setBusy(true);
    const response = await apiFetch(`/api/habits/${habitId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: 1, source: "manual" })
    });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    const nextState = (await response.json()) as TrackerState & { unlocked?: string[] };
    setState(nextState);

    const unlockedCode = nextState.unlocked?.[0];
    if (unlockedCode) {
      const unlocked = nextState.achievements.find((item) => item.achievement.code === unlockedCode);
      if (unlocked) {
        setAchievementModal(unlocked);
      }
    }

    setBusy(false);
  }

  async function archiveHabit(habitId: string) {
    setBusy(true);
    const response = await apiFetch(`/api/habits/${habitId}`, { method: "DELETE" });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    setState((await response.json()) as TrackerState);
    setBusy(false);
  }

  async function deleteEvent(eventId: string) {
    setBusy(true);
    const response = await apiFetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    setState((await response.json()) as TrackerState);
    setBusy(false);
  }

  async function downloadExport(format: "json" | "csv") {
    const response = await apiFetch(`/api/export${format === "csv" ? "?format=csv" : ""}`);
    if (!response.ok) {
      return;
    }

    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = format === "csv" ? "habit-events.csv" : "habit-tracker-export.json";
    link.click();
    URL.revokeObjectURL(href);
  }

  async function previewImport() {
    setBusy(true);
    const response = await apiFetch("/api/import/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: importMode, content: importText })
    });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    setImportPreview((await response.json()) as ImportPreview);
    setBusy(false);
  }

  async function commitImport() {
    setBusy(true);
    const response = await apiFetch("/api/import/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: importMode, content: importText })
    });
    if (!response.ok) {
      setBusy(false);
      return;
    }

    const payload = (await response.json()) as { state: TrackerState; result: ImportPreview };
    setState(payload.state);
    setImportPreview(payload.result);
    setBusy(false);
  }

  async function testReminders() {
    const response = await apiFetch("/api/reminders/test", { method: "POST" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { message: string; reminders: Array<{ habit_title: string; time_of_day: string }> };
    setReminderMessage(payload.message);

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if ("Notification" in window && Notification.permission === "granted" && payload.reminders[0]) {
      new Notification(payload.reminders[0].habit_title, {
        body: `Напоминание на ${payload.reminders[0].time_of_day}`
      });
    }
  }

  if (!authReady) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader" />
      </main>
    );
  }

  if (authClient && !session) {
    return (
      <AuthScreen
        mode={authMode}
        name={authName}
        email={authEmail}
        password={authPassword}
        message={authMessage}
        busy={busy}
        onModeChange={setAuthMode}
        onNameChange={setAuthName}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={(event) => void submitAuth(event)}
      />
    );
  }

  if (loading || !state) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader" />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Habit Tracker</p>
          <h1>Сегодня</h1>
        </div>
        <div className="top-actions">
          <div className="user-chip" title={state.user.email || state.user.name}>
            <Mail size={16} />
            <span>{state.user.name}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void copyInviteLink()} title="Скопировать приглашение">
            <Copy size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => void testReminders()} title="Проверить напоминания">
            <Bell size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => void downloadExport("json")} title="Экспорт JSON">
            <Download size={18} />
          </button>
          {authClient && (
            <button className="icon-button" type="button" onClick={() => void signOut()} title="Выйти">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </section>

      {reminderMessage && <div className="notice">{reminderMessage}</div>}

      <section className="metrics-grid" aria-label="Сводка">
        <Metric label="Активные" value={state.totals.active_habits} />
        <Metric label="Закрыто" value={`${state.totals.completed_now}/${state.totals.active_habits}`} />
        <Metric label="События" value={state.totals.events} />
        <Metric label="Лучшая серия" value={state.totals.best_streak} />
        <Metric label="Участники" value={state.social.members.length} />
      </section>

      <div className="workspace-grid">
        <section className="habit-list" aria-label="Привычки">
          {state.habits.map((item) => (
            <article
              className={clsx("habit-card", item.is_complete && "complete", selectedHabitId === item.habit.id && "selected")}
              key={item.habit.id}
              style={{ "--habit-color": item.habit.color } as CSSProperties}
            >
              <button className="habit-main" type="button" onClick={() => setSelectedHabitId(item.habit.id)}>
                <span className="habit-icon">
                  <IconByName name={item.habit.icon} />
                </span>
                <span className="habit-copy">
                  <span className="habit-title">{item.habit.title}</span>
                  <span className="habit-meta">
                    {formatFrequency(item.habit)} · {item.period_label}
                  </span>
                </span>
              </button>
              <div className="progress-row">
                <span>
                  {item.progress}/{item.target}
                </span>
                <span>{item.streak} streak</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${item.percentage}%` }} />
              </div>
              <div className="habit-actions">
                <button className="icon-button compact" type="button" onClick={() => setForm(formFromHabit(item))} title="Редактировать">
                  <Pencil size={16} />
                </button>
                <button className="icon-button compact danger" type="button" onClick={() => void archiveHabit(item.habit.id)} title="Архивировать">
                  <Trash2 size={16} />
                </button>
                <button className="check-button" type="button" disabled={busy} onClick={() => void checkIn(item.habit.id)}>
                  <Check size={18} />
                  Отметить
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="side-panel">
          <form className="editor" onSubmit={(event) => void submitHabit(event)}>
            <div className="panel-heading">
              <h2>{form.id ? "Привычка" : "Новая привычка"}</h2>
              {form.id && (
                <button className="icon-button compact" type="button" onClick={() => setForm(defaultForm)} title="Сбросить форму">
                  <X size={16} />
                </button>
              )}
            </div>

            <label>
              Название
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Например, медитация" />
            </label>

            <label>
              Заметка
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
                placeholder="Короткий контекст"
              />
            </label>

            <div className="control-row">
              <label>
                Ритм
                <select
                  value={form.frequency_type}
                  onChange={(event) => {
                    const frequency = event.target.value as FrequencyType;
                    setForm({ ...form, frequency_type: frequency, period_unit: getPeriodUnit(frequency), weekdays: frequency === "custom" ? form.weekdays : [] });
                  }}
                >
                  <option value="daily">По дням</option>
                  <option value="hourly">По часам</option>
                  <option value="weekly">По неделям</option>
                  <option value="custom">Дни недели</option>
                </select>
              </label>

              <label>
                Цель
                <input
                  type="number"
                  min={1}
                  value={form.target_count}
                  onChange={(event) => setForm({ ...form, target_count: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="control-row">
              <label>
                Интервал
                <input
                  type="number"
                  min={1}
                  value={form.period_interval}
                  onChange={(event) => setForm({ ...form, period_interval: Number(event.target.value) })}
                />
              </label>
              <label>
                Единица
                <select value={form.period_unit} onChange={(event) => setForm({ ...form, period_unit: event.target.value as PeriodUnit })}>
                  <option value="hour">Час</option>
                  <option value="day">День</option>
                  <option value="week">Неделя</option>
                </select>
              </label>
            </div>

            {form.frequency_type === "custom" && (
              <div className="weekday-picker" aria-label="Дни недели">
                {weekdays.map(([value, label]) => (
                  <button
                    className={clsx(form.weekdays.includes(value) && "active")}
                    type="button"
                    key={value}
                    onClick={() =>
                      setForm({
                        ...form,
                        weekdays: form.weekdays.includes(value) ? form.weekdays.filter((day) => day !== value) : [...form.weekdays, value].sort()
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="swatches" aria-label="Цвет">
              {colorOptions.map((color) => (
                <button
                  className={clsx(form.color === color && "active")}
                  style={{ background: color }}
                  type="button"
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  title={color}
                />
              ))}
            </div>

            <label>
              Иконка
              <select value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })}>
                {iconOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="reminder-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.reminder_enabled}
                  onChange={(event) => setForm({ ...form, reminder_enabled: event.target.checked })}
                />
                Напоминание
              </label>
              <input type="time" value={form.reminder_time} onChange={(event) => setForm({ ...form, reminder_time: event.target.value })} />
            </div>

            <button className="primary-button" type="submit" disabled={busy || !form.title.trim()}>
              {form.id ? <Save size={18} /> : <Plus size={18} />}
              {form.id ? "Сохранить" : "Добавить"}
            </button>
          </form>
        </aside>
      </div>

      <section className="social-grid" aria-label="Командный прогресс">
        <article className="detail-panel">
          <div className="panel-heading">
            <h2>Общая лига</h2>
            <Users size={18} />
          </div>
          <div className="member-list">
            {state.social.members.map((member, index) => (
              <div className={clsx("member-row", member.user_id === state.user.id && "current")} key={member.user_id}>
                <span className="rank">{index + 1}</span>
                <div>
                  <strong>{member.name}</strong>
                  <span>
                    {member.completed_now}/{member.active_habits} сегодня · {member.best_streak} streak
                  </span>
                </div>
                <strong>{member.score}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="detail-panel">
          <div className="panel-heading">
            <h2>Лидерборды</h2>
            <Medal size={18} />
          </div>
          <div className="leaderboard-list">
            {state.social.habit_leaderboards.length ? (
              state.social.habit_leaderboards.map((leaderboard) => (
                <div className="leaderboard-card" key={leaderboard.habit_key}>
                  <div className="leaderboard-title">
                    <strong>{leaderboard.title}</strong>
                    <span>{leaderboard.entries.length} участн.</span>
                  </div>
                  {leaderboard.entries.slice(0, 4).map((entry, index) => (
                    <div className={clsx("leaderboard-row", entry.user_id === state.user.id && "current")} key={`${entry.user_id}-${entry.habit_id}`}>
                      <span className="rank">{index + 1}</span>
                      <span className="leaderboard-user">{entry.name}</span>
                      <span>
                        {entry.progress}/{entry.target}
                      </span>
                      <span>{entry.streak}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="empty">Лидерборды появятся после первой привычки.</p>
            )}
          </div>
        </article>
      </section>

      <section className="detail-grid">
        <article className="detail-panel">
          <div className="panel-heading">
            <h2>{selectedHabit?.habit.title || "История"}</h2>
            <span className="subtle">{selectedHabit?.streak || 0} streak</span>
          </div>
          <div className="heatmap" aria-label="История по дням">
            {selectedHabit?.recent_days.map((day) => (
              <span
                key={day.date}
                className={clsx(day.value > 0 && "filled", day.complete && "complete")}
                title={`${day.date}: ${day.value}`}
                style={{ "--habit-color": selectedHabit.habit.color } as CSSProperties}
              />
            ))}
          </div>
          {selectedLeaderboard && (
            <div className="selected-leaderboard">
              {selectedLeaderboard.entries.slice(0, 5).map((entry, index) => (
                <div className={clsx("leaderboard-row", entry.user_id === state.user.id && "current")} key={`${entry.user_id}-${entry.habit_id}`}>
                  <span className="rank">{index + 1}</span>
                  <span className="leaderboard-user">{entry.name}</span>
                  <span>
                    {entry.progress}/{entry.target}
                  </span>
                  <span>{entry.streak}</span>
                </div>
              ))}
            </div>
          )}
          <div className="event-list">
            {selectedHabit?.events.length ? (
              selectedHabit.events.map((event) => (
                <div className="event-row" key={event.id}>
                  <span>{formatDateTime(event.occurred_at)}</span>
                  <strong>+{event.value}</strong>
                  <button className="icon-button compact danger" type="button" onClick={() => void deleteEvent(event.id)} title="Удалить событие">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="empty">Пока нет отметок.</p>
            )}
          </div>
        </article>

        <article className="detail-panel">
          <div className="panel-heading">
            <h2>Ачивки</h2>
            <Award size={18} />
          </div>
          <div className="achievement-grid">
            {state.achievement_catalog.map((achievement) => {
              const unlocked = state.achievements.find((item) => item.achievement.code === achievement.code);
              return (
                <div className={clsx("achievement-card", achievement.rarity, unlocked && "unlocked")} key={achievement.code}>
                  <span className="achievement-icon">
                    <IconByName name={achievement.icon} size={22} />
                  </span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <span>{unlocked ? "Получено" : achievement.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="detail-panel import-panel">
          <div className="panel-heading">
            <h2>Данные</h2>
            <div className="panel-actions">
              <button className="icon-button compact" type="button" onClick={() => void downloadExport("json")} title="Скачать JSON">
                <Download size={15} />
              </button>
              <button className="icon-button compact" type="button" onClick={() => void downloadExport("csv")} title="Скачать CSV">
                <Upload size={15} />
              </button>
            </div>
          </div>
          <div className="segmented">
            <button className={clsx(importMode === "json" && "active")} type="button" onClick={() => setImportMode("json")}>
              JSON
            </button>
            <button className={clsx(importMode === "csv" && "active")} type="button" onClick={() => setImportMode("csv")}>
              CSV
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={7}
            placeholder={importMode === "json" ? "{ ... }" : "habit_title,habit_id,occurred_at,value,note,source"}
          />
          {importPreview && (
            <div className="import-summary">
              <span>Привычки: {importPreview.habitsCreated}</span>
              <span>События: {importPreview.eventsCreated}</span>
              <span>Напоминания: {importPreview.remindersCreated}</span>
              {importPreview.errors.length > 0 && <strong>Ошибки: {importPreview.errors.length}</strong>}
            </div>
          )}
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={!importText.trim() || busy} onClick={() => void previewImport()}>
              <Import size={16} />
              Предпросмотр
            </button>
            <button className="primary-button" type="button" disabled={!importPreview || busy} onClick={() => void commitImport()}>
              <Upload size={16} />
              Импорт
            </button>
          </div>
        </article>
      </section>

      {achievementModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className={clsx("achievement-modal", achievementModal.achievement.rarity)}>
            <button className="icon-button compact modal-close" type="button" onClick={() => setAchievementModal(null)} title="Закрыть">
              <X size={16} />
            </button>
            <span className="modal-medal">
              <IconByName name={achievementModal.achievement.icon} size={40} />
            </span>
            <p className="eyebrow">Ачивка</p>
            <h2>{achievementModal.achievement.title}</h2>
            <p>{achievementModal.achievement.description}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function AuthScreen({
  mode,
  name,
  email,
  password,
  message,
  busy,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  message: string;
  busy: boolean;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSignUp = mode === "sign-up";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="auth-logo">
            <Users size={26} />
          </span>
          <div>
            <p className="eyebrow">Habit Tracker</p>
            <h1>{isSignUp ? "Создать аккаунт" : "Войти"}</h1>
          </div>
        </div>

        <div className="segmented auth-tabs">
          <button className={clsx(mode === "sign-in" && "active")} type="button" onClick={() => onModeChange("sign-in")}>
            Вход
          </button>
          <button className={clsx(isSignUp && "active")} type="button" onClick={() => onModeChange("sign-up")}>
            Регистрация
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {isSignUp && (
            <label>
              Имя
              <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Как показывать в рейтинге" />
            </label>
          )}

          <label>
            Email
            <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" required />
          </label>

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              minLength={6}
              placeholder="Минимум 6 символов"
              required
            />
          </label>

          {message && <div className="notice auth-notice">{message}</div>}

          <button className="primary-button" type="submit" disabled={busy || !email.trim() || password.length < 6}>
            {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isSignUp ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
