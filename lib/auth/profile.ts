import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/auth-env";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export type Role = "admin" | "member";

export type SessionProfile = {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
};

export type AppSlug = "nox-crm" | "nox-data-hub";

export const getSessionUser = cache(async () => {
  if (!isAuthConfigured()) return null;
  try {
    const supabase = await createServerAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    const admin = createServerSupabase();
    const { data } = await admin
      .from("profiles")
      .select("id, email, role, full_name")
      .eq("id", user.id)
      .single();

    if (data) {
      return {
        id: data.id as string,
        email: data.email as string,
        role: (data.role as Role) ?? "member",
        fullName: (data.full_name as string | null) ?? null,
      };
    }
  } catch {
    /* profiles missing */
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: "member",
    fullName: null,
  };
}

export async function getUserAppAccess(userId: string): Promise<AppSlug[]> {
  try {
    const admin = createServerSupabase();
    const { data, error } = await admin
      .from("user_app_access")
      .select("app_slug")
      .eq("user_id", userId);

    if (error) {
      // Table not migrated — default both apps for existing users
      return ["nox-crm", "nox-data-hub"];
    }

    const slugs = (data ?? []).map((r) => r.app_slug as AppSlug);
    if (slugs.length === 0) return ["nox-data-hub"];
    return slugs;
  } catch {
    return ["nox-data-hub"];
  }
}

export function getAppUrls() {
  return {
    crm: process.env.NEXT_PUBLIC_NOX_CRM_URL?.trim() || "http://localhost:3000",
    dataHub:
      process.env.NEXT_PUBLIC_NOX_DATA_HUB_URL?.trim() ||
      "http://localhost:3001",
  };
}
