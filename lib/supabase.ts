import { createClient } from "@supabase/supabase-js";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

/** Anon client — used for auth operations (signInWithIdToken, getUser, refreshSession). */
export function createAnonClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY")
  );
}

/** Admin client — uses service-role key for storage uploads and profile upserts. */
export function createAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
