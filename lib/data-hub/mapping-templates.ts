import { mergeInstallerOptions } from "@/lib/data-hub/installers";
import { listAllPublicDeals } from "@/lib/public-deals/client";

export async function listInstallerNames(): Promise<string[]> {
  const rows = await listAllPublicDeals();
  const fromDb = rows
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
  void schemaType;
  void installerName;
  return [];
}
