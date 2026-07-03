import { NextResponse } from "next/server";
import { deleteEvent } from "@/lib/db";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  await deleteEvent(eventId);
  return NextResponse.json(await getTrackerState());
}
