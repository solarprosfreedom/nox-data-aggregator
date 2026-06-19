"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

export async function inviteUser(fields: {
  email: string;
  full_name: string;
  role: "admin" | "member";
}): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    await requireAdmin();
    const db = createServerSupabase();
    const email = fields.email.trim().toLowerCase();
    if (!email) return { error: "Email is required." };

    // Create auth user (OTP/magic link login — no password needed).
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr && !createErr.message.toLowerCase().includes("already")) {
      return { error: createErr.message };
    }

    const userId = created?.user?.id;
    const uid = userId ?? (await db.from("profiles").select("id").eq("email", email).maybeSingle()).data?.id;
    if (!uid) return { error: "Could not resolve user ID." };

    await db.from("profiles").upsert({
      id: uid,
      email,
      role: fields.role,
      full_name: fields.full_name.trim() || null,
    }, { onConflict: "id" });

    await db.from("user_app_access").upsert(
      { user_id: uid, app_slug: "nox-data-hub" },
      { onConflict: "user_id,app_slug" }
    );

    revalidatePath("/admin");
    return { ok: true, message: `${email} added successfully.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add user." };
  }
}

export async function removeAccess(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin();
    const db = createServerSupabase();

    // Don't allow removing your own access.
    const self = await getCurrentProfile();
    if (self?.id === userId) return { error: "You cannot remove your own access." };

    await db.from("profiles").delete().eq("id", userId);
    await db.from("user_app_access").delete().eq("user_id", userId);

    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove access." };
  }
}

export async function setRole(
  userId: string,
  role: "admin" | "member"
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin();
    const self = await getCurrentProfile();
    if (self?.id === userId) return { error: "You cannot change your own role." };
    const db = createServerSupabase();
    await db.from("profiles").update({ role }).eq("id", userId);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update role." };
  }
}

export async function listHubUsers() {
  const db = createServerSupabase();
  const { data } = await db
    .from("profiles")
    .select("id, email, role, full_name")
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((p) => p.id && p.email)
    .map((p) => ({
      id: p.id as string,
      email: p.email as string,
      role: (p.role as "admin" | "member") ?? "member",
      fullName: (p.full_name as string | null) ?? null,
    }));
}
