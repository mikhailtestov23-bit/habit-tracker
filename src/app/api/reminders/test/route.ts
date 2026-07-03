import { NextResponse } from "next/server";
import { getHabits, getReminders, getTimezone } from "@/lib/db";
import { getLocalWeekday } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function POST() {
  const timezone = await getTimezone();
  const weekday = getLocalWeekday(new Date(), timezone);
  const habits = await getHabits();
  const due = (await getReminders())
    .filter((reminder) => reminder.is_enabled && (!reminder.weekdays?.length || reminder.weekdays.includes(weekday)))
    .map((reminder) => ({
      ...reminder,
      habit_title: habits.find((habit) => habit.id === reminder.habit_id)?.title || "Привычка"
    }));

  return NextResponse.json({
    message: due.length ? "Есть напоминания на сегодня." : "На сегодня активных напоминаний нет.",
    reminders: due
  });
}
