"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/profile";
import { detectImportSourceFromCsv, hashFileContent } from "@/lib/data-hub/normalize";
import { processImport } from "@/lib/data-hub/importer";
import { createServerSupabase } from "@/lib/supabase/server";

export type UploadResult =
  | {
      ok: true;
      source: string;
      rowCount: number;
      inserted: number;
      updated: number;
      matched: number;
      errors: number;
      errorMessages: string[];
    }
  | { error: string };

export async function uploadImportFile(formData: FormData): Promise<UploadResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };

  const fileName = file.name;
  if (!fileName.toLowerCase().endsWith(".csv")) {
    return { error: "Only CSV files are supported for now." };
  }

  const content = await file.text();
  if (!content.trim()) return { error: "File is empty." };

  const sourceOverride = formData.get("source");
  const installer = String(formData.get("installer") ?? "").trim() || null;
  const validSources = ["projects_sheet", "remittance"] as const;
  const source =
    typeof sourceOverride === "string" &&
    validSources.includes(sourceOverride as (typeof validSources)[number])
      ? (sourceOverride as (typeof validSources)[number])
      : (detectImportSourceFromCsv(content, fileName) === "remittance"
          ? "remittance"
          : "projects_sheet");

  try {
    const db = createServerSupabase();
    const fileHash = await hashFileContent(content);
    const result = await processImport({
      db,
      source,
      fileName,
      fileHash,
      content,
      uploadedBy: user.id,
      installer: source === "projects_sheet" ? installer : null,
    });

    revalidatePath("/projects");
    revalidatePath("/imports/history");

    return {
      ok: true,
      source,
      rowCount: result.rowCount,
      inserted: result.inserted,
      updated: result.updated,
      matched: result.matched,
      errors: result.errors,
      errorMessages: result.errorMessages.slice(0, 10),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Import failed.",
    };
  }
}
