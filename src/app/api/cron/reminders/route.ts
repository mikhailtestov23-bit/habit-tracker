import { NextResponse } from "next/server";
import { getHabits, getReminders, markReminderSent } from "@/lib/db";
import { getLocalDateKey, getLocalWeekday, nowIso } from "@/lib/time";

export const dynamic = "force-dynamic";

function localMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function reminderMinutes(timeOfDay: string) {
  const [hour, minute] = timeOfDay.split(":").map(Number);
  return Number(hour || 0) * 60 + Number(minute || 0);
}

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  const authorization = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production" && secret && authorization !== `Bearer ${secret}` && !userAgent.includes("vercel-cron/1.0")) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const now = new Date();
  const [habits, reminders] = await Promise.all([getHabits(), getReminders()]);
  const due = reminders.filter((reminder) => {
    if (!reminder.is_enabled) {
      return false;
    }

    const weekday = getLocalWeekday(now, reminder.timezone);
    if (reminder.weekdays?.length && !reminder.weekdays.includes(weekday)) {
      return false;
    }

    const today = getLocalDateKey(now, reminder.timezone);
    if (reminder.last_sent_at && getLocalDateKey(reminder.last_sent_at, reminder.timezone) === today) {
      return false;
    }

    return localMinutes(now, reminder.timezone) >= reminderMinutes(reminder.time_of_day);
  });

  const sentAt = nowIso();
  await Promise.all(due.map((reminder) => markReminderSent(reminder.id, sentAt)));

  return NextResponse.json({
    processed_at: sentAt,
    reminders: due.map((reminder) => ({
      id: reminder.id,
      habit_id: reminder.habit_id,
      habit_title: habits.find((habit) => habit.id === reminder.habit_id)?.title || "Привычка",
      channel: reminder.channel,
      time_of_day: reminder.time_of_day,
      timezone: reminder.timezone
    }))
  });
}
