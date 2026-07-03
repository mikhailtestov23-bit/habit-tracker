"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getPublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function hasBrowserSupabaseConfig() {
  return Boolean(getUrl() && getPublishableKey());
}

export function getSupabaseBrowserClient() {
  const url = getUrl();
  const key = getPublishableKey();

  if (!url || !key) {
    throw new Error("Supabase browser client is not configured.");
  }

  if (!browserClient) {
    browserClient = createClient(url, key);
  }

  return browserClient;
}
