import { NextResponse } from "next/server";
import { importData } from "@/lib/db";
import { normalizeImportBody } from "@/lib/importExport";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = normalizeImportBody(await request.json());
  return NextResponse.json(await importData(payload, true));
}
