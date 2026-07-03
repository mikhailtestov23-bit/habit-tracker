import { NextResponse } from "next/server";
import { withRequestAuth } from "@/lib/auth";
import { exportData, getHabits, getEvents } from "@/lib/db";
import { eventsToCsv } from "@/lib/importExport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withRequestAuth(request, async () => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    if (format === "csv") {
      const habits = await getHabits();
      const csv = eventsToCsv(
        (await getEvents()).map((event) => ({
          ...event,
          habit_title: habits.find((habit) => habit.id === event.habit_id)?.title || "Unknown"
        }))
      );

      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=habit-events.csv"
        }
      });
    }

    return NextResponse.json(await exportData(), {
      headers: {
        "content-disposition": "attachment; filename=habit-tracker-export.json"
      }
    });
  });
}
