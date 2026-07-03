import { NextResponse } from "next/server";
import { withRequestAuth } from "@/lib/auth";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withRequestAuth(request, async () => NextResponse.json(await getTrackerState()));
}
