import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { DEFAULT_TIMEZONE, LOCAL_USER_ID } from "@/lib/dbLocal";
import { runWithRequestUser } from "@/lib/requestContext";
import { UserProfile } from "@/lib/types";

let authClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function shouldRequireAuth() {
  if (process.env.DATA_BACKEND === "sqlite") {
    return false;
  }

  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

function getAuthClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();

  if (!url || !key) {
    throw new Error("Supabase auth is not configured.");
  }

  if (!authClient) {
    authClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return authClient;
}

function localUser(): UserProfile {
  return {
    id: LOCAL_USER_ID,
    email: null,
    name: "Local user",
    timezone: DEFAULT_TIMEZONE
  };
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function getRequestAuthUser(request: Request): Promise<UserProfile | null> {
  if (!shouldRequireAuth()) {
    return localUser();
  }

  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const metadata = data.user.user_metadata || {};
  const name = String(metadata.name || metadata.full_name || data.user.email?.split("@")[0] || "Участник");

  return {
    id: data.user.id,
    email: data.user.email || null,
    name,
    timezone: DEFAULT_TIMEZONE
  };
}

export async function withRequestAuth(request: Request, callback: () => Promise<Response>) {
  const user = await getRequestAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Требуется вход в аккаунт." }, { status: 401 });
  }

  return runWithRequestUser(user, callback);
}
