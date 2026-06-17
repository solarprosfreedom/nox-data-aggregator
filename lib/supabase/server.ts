import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/auth-env";

export function createServerSupabase() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}
