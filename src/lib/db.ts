import * as local from "@/lib/dbLocal";
import * as supabaseDb from "@/lib/dbSupabase";

function shouldUseSupabase() {
  if (process.env.DATA_BACKEND === "supabase") {
    return true;
  }

  if (process.env.DATA_BACKEND === "sqlite") {
    return false;
  }

  return supabaseDb.hasSupabaseConfig();
}

function adapter() {
  if (shouldUseSupabase()) {
    return supabaseDb;
  }

  return local;
}

export const LOCAL_USER_ID = local.LOCAL_USER_ID;
export const DEFAULT_TIMEZONE = local.DEFAULT_TIMEZONE;

export async function getTimezone() {
  return adapter().getTimezone();
}

export async function getHabits() {
  return adapter().getHabits();
}

export async function getEvents() {
  return adapter().getEvents();
}

export async function getReminders() {
  return adapter().getReminders();
}

export async function getAchievements() {
  return adapter().getAchievements();
}

export async function getUnlockedAchievements() {
  return adapter().getUnlockedAchievements();
}

export async function createHabit(...args: Parameters<typeof local.createHabit>) {
  return adapter().createHabit(...args);
}

export async function updateHabit(...args: Parameters<typeof local.updateHabit>) {
  return adapter().updateHabit(...args);
}

export async function archiveHabit(...args: Parameters<typeof local.archiveHabit>) {
  return adapter().archiveHabit(...args);
}

export async function createEvent(...args: Parameters<typeof local.createEvent>) {
  return adapter().createEvent(...args);
}

export async function deleteEvent(...args: Parameters<typeof local.deleteEvent>) {
  return adapter().deleteEvent(...args);
}

export async function upsertReminder(...args: Parameters<typeof local.upsertReminder>) {
  return adapter().upsertReminder(...args);
}

export async function markReminderSent(...args: Parameters<typeof local.markReminderSent>) {
  return adapter().markReminderSent(...args);
}

export async function unlockAchievement(...args: Parameters<typeof local.unlockAchievement>) {
  return adapter().unlockAchievement(...args);
}

export async function exportData() {
  return adapter().exportData();
}

export async function importData(...args: Parameters<typeof local.importData>) {
  return adapter().importData(...args);
}

export function getActiveBackend() {
  return shouldUseSupabase() ? "supabase" : "sqlite";
}
