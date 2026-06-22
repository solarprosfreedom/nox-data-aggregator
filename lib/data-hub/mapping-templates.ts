import { createServerSupabase } from "@/lib/supabase/server";
import { mergeInstallerOptions } from "@/lib/data-hub/installers";

export async function listInstallerNames(): Promise<string[]> {
  const db = createServerSupabase();
  const { data, error } = await db.from("projects").select("installer");
  if (error) {
    if (error.message.includes("projects")) return mergeInstallerOptions([]);
    throw new Error(error.message);
  }
  const fromDb = (data ?? [])
    .map((r) => (r.installer != null ? String(r.installer) : ""))
    .filter(Boolean);
  return mergeInstallerOptions(fromDb);
}

export type MappingTemplate = {
  id: string;
  name: string;
  installer_name: string | null;
  schema_type: "projects" | "remittance";
  column_map: Record<string, string>;
  created_at: string;
};

export async function listMappingTemplates(
  schemaType?: "projects" | "remittance",
  installerName?: string
): Promise<MappingTemplate[]> {
  const db = createServerSupabase();
  let query = db
    .from("mapping_templates")
    .select("id, name, installer_name, schema_type, column_map, created_at")
    .order("created_at", { ascending: false });

  if (schemaType) query = query.eq("schema_type", schemaType);
  if (installerName?.trim()) {
    query = query.eq("installer_name", installerName.trim());
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("mapping_templates")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    installer_name: row.installer_name != null ? String(row.installer_name) : null,
    schema_type: row.schema_type as "projects" | "remittance",
    column_map: (row.column_map ?? {}) as Record<string, string>,
    created_at: String(row.created_at),
  }));
}
