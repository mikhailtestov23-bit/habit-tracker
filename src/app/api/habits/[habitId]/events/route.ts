import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAchievementsForEvent } from "@/lib/achievements";
import { withRequestAuth } from "@/lib/auth";
import { createEvent, getEvents } from "@/lib/db";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ habitId: string }>;
};

const eventSchema = z.object({
  occurred_at: z.string().optional(),
  value: z.coerce.number().positive().default(1),
  note: z.string().nullable().optional(),
  source: z.enum(["manual", "import", "reminder", "automation"]).default("manual")
});

export async function GET(_request: Request, context: RouteContext) {
  return withRequestAuth(_request, async () => {
    const { habitId } = await context.params;
    return NextResponse.json((await getEvents()).filter((event) => event.habit_id === habitId));
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withRequestAuth(request, async () => {
    const { habitId } = await context.params;
    const input = eventSchema.parse(await request.json());
    await createEvent({ habit_id: habitId, ...input });
    const unlocked = await evaluateAchievementsForEvent(habitId, input.occurred_at || new Date().toISOString());
    return NextResponse.json({ ...(await getTrackerState()), unlocked }, { status: 201 });
  });
}
