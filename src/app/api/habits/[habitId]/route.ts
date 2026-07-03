import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveHabit, updateHabit } from "@/lib/db";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ habitId: string }>;
};

const habitUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  color: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  frequency_type: z.enum(["hourly", "daily", "weekly", "custom"]).optional(),
  target_count: z.coerce.number().int().min(1).optional(),
  period_interval: z.coerce.number().int().min(1).optional(),
  period_unit: z.enum(["hour", "day", "week"]).optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  reminder: z
    .object({
      is_enabled: z.boolean(),
      time_of_day: z.string().default("09:00"),
      weekdays: z.array(z.number().int().min(1).max(7)).nullable().optional()
    })
    .optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const { habitId } = await context.params;
  await updateHabit(habitId, habitUpdateSchema.parse(await request.json()));
  return NextResponse.json(await getTrackerState());
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { habitId } = await context.params;
  await archiveHabit(habitId);
  return NextResponse.json(await getTrackerState());
}
