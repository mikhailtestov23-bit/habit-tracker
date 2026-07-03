const DAY_MS = 24 * 60 * 60 * 1000;

export function nowIso() {
  return new Date().toISOString();
}

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getLocalDateKey(dateInput: string | Date, timeZone: string) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getLocalWeekday(dateInput: string | Date, timeZone: string) {
  const key = getLocalDateKey(dateInput, timeZone);
  const utcDate = dateKeyToUtcDate(key);
  const day = utcDate.getUTCDay();
  return day === 0 ? 7 : day;
}

export function getWeekKey(dateInput: string | Date, timeZone: string) {
  const key = getLocalDateKey(dateInput, timeZone);
  const date = dateKeyToUtcDate(key);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  return toDateKey(date);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function dateKeyToUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getRecentDateKeys(count: number, timeZone: string, endDate = new Date()) {
  const today = getLocalDateKey(endDate, timeZone);
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(today, index - count + 1));
}

export function getHourlyWindow(startsAt: string, intervalHours: number, now = new Date()) {
  const startTime = new Date(startsAt).getTime();
  const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
  const elapsed = Math.max(now.getTime() - startTime, 0);
  const windowStartMs = startTime + Math.floor(elapsed / intervalMs) * intervalMs;
  return {
    start: new Date(windowStartMs),
    end: new Date(windowStartMs + intervalMs)
  };
}

export function getDateKeyDifference(later: string, earlier: string) {
  return Math.round((dateKeyToUtcDate(later).getTime() - dateKeyToUtcDate(earlier).getTime()) / DAY_MS);
}
