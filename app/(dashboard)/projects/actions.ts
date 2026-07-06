"use server";

import { revalidatePath } from "next/cache";
import {
  buildRemittanceUpdatePayload,
  PROJECT_EDIT_FIELDS,
  remittanceFormHasValues,
  type ProjectFormData,
} from "@/lib/data-hub/project-edit-form";
import {
  deletePublicDealFromHub,
  patchPublicDealFromHub,
} from "@/lib/data-hub/public-deals-sync";

export type { ProjectFormData };

function toNum(v: string): number | null {
  const n = parseFloat(v.replace(/[$,]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function toDate(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function str(v: string): string | null {
  return v.trim() || null;
}

export async function updateProject(
  id: string,
  form: ProjectFormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    const projectId = id;
    const installer = form.installer?.trim() || null;

    const projectUpdate: Record<string, string | number | null> = {};
    for (const { key, type } of PROJECT_EDIT_FIELDS) {
      const raw = form[key] ?? "";
      if (type === "number") {
        projectUpdate[key] = toNum(raw);
      } else if (type === "date") {
        projectUpdate[key] = toDate(raw);
      } else {
        projectUpdate[key] = str(raw);
      }
    }

    await patchPublicDealFromHub({
      installer,
      project: {
        project_id: projectId,
        ...projectUpdate,
      },
      remittance: remittanceFormHasValues(form)
        ? {
            payment_date: toDate(form.payment_date),
            ...buildRemittanceUpdatePayload(form),
          }
        : {},
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function deleteProject(
  id: string,
  installerHint?: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await deletePublicDealFromHub({
      installer: installerHint ?? null,
      projectId: id,
    });
    revalidatePath("/projects");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed." };
  }
}
