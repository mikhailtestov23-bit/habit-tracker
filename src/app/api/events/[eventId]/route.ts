import { NextResponse } from "next/server";
import { withRequestAuth } from "@/lib/auth";
import { deleteEvent } from "@/lib/db";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  return withRequestAuth(request, async () => {
    const { eventId } = await context.params;
    await deleteEvent(eventId);
    return NextResponse.json(await getTrackerState());
  });
}
