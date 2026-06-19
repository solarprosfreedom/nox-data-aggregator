"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export type ProjectFormData = {
  opportunity_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state_code: string;
  postal_code: string;
  project_stage: string;
  contract_signed_date: string;
  total_system_cost: string;
  system_size_kw: string;
  installer: string;
  sales_advisor_name: string;
  sales_advisor_email: string;
  setter_name: string;
  setter_email: string;
  closer_name: string;
  closer_email: string;
  market: string;
  team: string;
  region: string;
  division: string;
  dealer_name: string;
  office_name: string;
};

function toNum(v: string): number | null {
  const n = parseFloat(v.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

function toDate(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function str(v: string): string | null {
  return v.trim() || null;
}

export async function updateProject(
  id: string,
  form: ProjectFormData
): Promise<{ ok: true } | { error: string }> {
  try {
    const db = createServerSupabase();
    const { error } = await db
      .from("projects")
      .update({
        opportunity_name: str(form.opportunity_name),
        first_name: str(form.first_name),
        last_name: str(form.last_name),
        email: str(form.email),
        phone: str(form.phone),
        address_line1: str(form.address_line1),
        city: str(form.city),
        state_code: str(form.state_code),
        postal_code: str(form.postal_code),
        project_stage: str(form.project_stage),
        contract_signed_date: toDate(form.contract_signed_date),
        total_system_cost: toNum(form.total_system_cost),
        system_size_kw: toNum(form.system_size_kw),
        installer: str(form.installer),
        sales_advisor_name: str(form.sales_advisor_name),
        sales_advisor_email: str(form.sales_advisor_email),
        setter_name: str(form.setter_name),
        setter_email: str(form.setter_email),
        closer_name: str(form.closer_name),
        closer_email: str(form.closer_email),
        market: str(form.market),
        team: str(form.team),
        region: str(form.region),
        division: str(form.division),
        dealer_name: str(form.dealer_name),
        office_name: str(form.office_name),
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/projects");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function deleteProject(
  id: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const db = createServerSupabase();
    const { error } = await db.from("projects").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/projects");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed." };
  }
}
