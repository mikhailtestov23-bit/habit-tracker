import { NextResponse } from "next/server";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTrackerState());
}
