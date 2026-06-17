"use server";

import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { sendLoginCodeToEmail } from "@/lib/auth/send-login-code";

export type ActionResult = { ok: true } | { error: string };

export async function requestCode(email: string): Promise<ActionResult> {
  return sendLoginCodeToEmail(email);
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createServerAuthClient();
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}

export async function verifyCode(
  email: string,
  token: string
): Promise<ActionResult> {
  const normalized = email.trim().toLowerCase();
  const code = token.trim();
  if (!code) return { error: "Enter the code from your email." };

  try {
    const supabase = await createServerAuthClient();
    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: code,
      type: "email",
    });
    if (error) return { error: "Invalid or expired code. Try again." };
    return { ok: true };
  } catch {
    return { error: "Sign-in is not configured yet." };
  }
}
