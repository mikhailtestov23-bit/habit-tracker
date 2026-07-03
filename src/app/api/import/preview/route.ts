import { NextResponse } from "next/server";
import { withRequestAuth } from "@/lib/auth";
import { importData } from "@/lib/db";
import { normalizeImportBody } from "@/lib/importExport";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withRequestAuth(request, async () => {
    const payload = normalizeImportBody(await request.json());
    return NextResponse.json(await importData(payload, true));
  });
}
