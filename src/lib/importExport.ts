import { ImportPayload } from "@/lib/types";

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function csvEventsToImportPayload(csv: string): ImportPayload {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV должен содержать заголовок и хотя бы одну строку события.");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    habits: [],
    events: rows.map((row) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
      return {
        habit_title: record.habit_title || undefined,
        habit_id: record.habit_id || undefined,
        occurred_at: record.occurred_at,
        value: record.value ? Number(record.value) : 1,
        note: record.note || null,
        source: "import"
      };
    })
  };
}

export function eventsToCsv(
  events: Array<{
    habit_title: string;
    habit_id: string;
    occurred_at: string;
    value: number;
    note: string | null;
    source: string;
  }>
) {
  const escape = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    "habit_title,habit_id,occurred_at,value,note,source",
    ...events.map((event) =>
      [event.habit_title, event.habit_id, event.occurred_at, event.value, event.note, event.source].map(escape).join(",")
    )
  ].join("\n");
}

export function normalizeImportBody(body: unknown): ImportPayload {
  if (typeof body === "object" && body && "kind" in body) {
    const typed = body as { kind?: string; content?: string; payload?: ImportPayload };
    if (typed.kind === "csv" && typed.content) {
      return csvEventsToImportPayload(typed.content);
    }

    if (typed.kind === "json" && typed.content) {
      return JSON.parse(typed.content) as ImportPayload;
    }

    if (typed.payload) {
      return typed.payload;
    }
  }

  return body as ImportPayload;
}
