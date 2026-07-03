import { NextResponse } from "next/server";
import { z } from "zod";
import { createHabit } from "@/lib/db";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

const habitSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().min(1).default("#14b8a6"),
  icon: z.string().min(1).default("circle-check"),
  frequency_type: z.enum(["hourly", "daily", "weekly", "custom"]),
  target_count: z.coerce.number().int().min(1).default(1),
  period_interval: z.coerce.number().int().min(1).default(1),
  period_unit: z.enum(["hour", "day", "week"]),
  weekdays: z.array(z.number().int().min(1).max(7)).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  reminder: z
    .object({
      is_enabled: z.boolean(),
      time_of_day: z.string().default("09:00"),
      weekdays: z.array(z.number().int().min(1).max(7)).nullable().optional()
    })
    .optional()
});

export async function GET() {
  return NextResponse.json(await getTrackerState());
}

export async function POST(request: Request) {
  const input = habitSchema.parse(await request.json());
  await createHabit(input);
  return NextResponse.json(await getTrackerState(), { status: 201 });
}
