import { createServerSupabase } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { sendLoginCodeEmail } from "@/lib/auth/login-code-email";
import { isGraphMailConfigured } from "@/lib/microsoft/graph-auth";

export type SendLoginCodeResult = { ok: true } | { error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findAuthUserId(email: string) {
  const admin = createServerSupabase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function isAllowedEmail(email: string) {
  const admin = createServerSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (data) return { allowed: true as const };
  if (error) {
    const authUserId = await findAuthUserId(email);
    if (authUserId) return { allowed: true as const };
    return { allowed: false as const, reason: "Could not verify access." };
  }
  const authUserId = await findAuthUserId(email);
  if (authUserId) return { allowed: true as const };
  return { allowed: false as const };
}

export async function sendLoginCodeToEmail(
  email: string
): Promise<SendLoginCodeResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { error: "Enter your email address." };

  const access = await isAllowedEmail(normalized);
  if (!access.allowed) {
    return {
      error: access.reason ?? "Ask an admin to add you in CRM Settings → Access.",
    };
  }

  if (isGraphMailConfigured()) {
    const admin = createServerSupabase();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalized,
    });
    const code = data?.properties?.email_otp;
    if (error || !code) {
      return { error: error?.message ?? "Could not generate a login code." };
    }
    await sendLoginCodeEmail({ to: normalized, code });
    return { ok: true };
  }

  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: false },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
