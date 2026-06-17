import { createServerSupabase } from "@/lib/supabase/server";

export type Project = {
  id: string;
  project_id: string;
  opportunity_name: string | null;
  email: string | null;
  phone: string | null;
  project_stage: string | null;
  sales_advisor_name: string | null;
  setter_name: string | null;
  setter_email: string | null;
  total_system_cost: number | null;
  system_size_kw: number | null;
  terros_account_id: string | null;
  updated_at: string;
};

export async function listProjects(limit = 100, search?: string): Promise<Project[]> {
  const db = createServerSupabase();
  let query = db
    .from("projects")
    .select(
      "id, project_id, opportunity_name, email, phone, project_stage, sales_advisor_name, setter_name, setter_email, total_system_cost, system_size_kw, terros_account_id, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `project_id.ilike.%${search}%,opportunity_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("projects")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Project[];
}

export async function getProject(id: string) {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listRemittance(limit = 500, search?: string) {
  const db = createServerSupabase();
  let query = db
    .from("remittance")
    .select("*")
    .order("payment_date", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `hes_code.ilike.%${search}%,customer_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("remittance")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function listImportHistory(limit = 50) {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("hub_import_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("hub_import_log")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function countProjects() {
  const db = createServerSupabase();
  const { count, error } = await db
    .from("projects")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
