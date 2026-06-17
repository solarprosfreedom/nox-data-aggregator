import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseServerAuthKey,
  getSupabaseUrl,
  isAuthConfigured,
} from "@/lib/supabase/auth-env";

export { isAuthConfigured };

export async function createServerAuthClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerAuthKey();
  if (!url || !key) {
    throw new Error("Missing Supabase URL or auth key");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* Server Component — proxy refreshes session */
        }
      },
    },
  });
}
