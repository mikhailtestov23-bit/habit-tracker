import { NextResponse } from "next/server";
import { withRequestAuth } from "@/lib/auth";
import { importData } from "@/lib/db";
import { normalizeImportBody } from "@/lib/importExport";
import { getTrackerState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withRequestAuth(request, async () => {
    const payload = normalizeImportBody(await request.json());
    const result = await importData(payload, false);
    return NextResponse.json({ result, state: await getTrackerState() });
  });
}
