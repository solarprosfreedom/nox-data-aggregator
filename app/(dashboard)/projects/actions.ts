"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildRemittanceUpdatePayload,
  PROJECT_EDIT_FIELDS,
  remittanceFormHasValues,
  type ProjectFormData,
} from "@/lib/data-hub/project-edit-form";
import { refreshNetEpcForProjects } from "@/lib/data-hub/remittance-project-sync";
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function loadProjectForAction(
  db: ReturnType<typeof createServerSupabase>,
  id: string,
) {
  const query = db.from("projects").select("project_id, installer");
  const { data, error } = isUuid(id)
    ? await query.or(`id.eq.${id},project_id.eq.${id}`).maybeSingle()
    : await query.eq("project_id", id).maybeSingle();
  return { data, error };
}

async function saveLatestRemittance(
  db: ReturnType<typeof createServerSupabase>,
  projectUuid: string,
  hesCode: string,
  form: ProjectFormData,
): Promise<string | null> {
  if (!remittanceFormHasValues(form) && !form.remittance_id.trim()) {
    return null;
  }

  const paymentDate = toDate(form.payment_date);
  if (!paymentDate) {
    return "Remittance payment date is required when editing remittance fields.";
  }

  const payload = {
    ...buildRemittanceUpdatePayload(form),
    payment_date: paymentDate,
    hes_code: hesCode,
    project_id: projectUuid,
  };

  const remittanceId = form.remittance_id.trim();
  if (remittanceId) {
    const { error } = await db.from("remittance").update(payload).eq("id", remittanceId);
    if (error) return error.message;
    return null;
  }

  const { error } = await db.from("remittance").upsert(
    {
      ...payload,
      file_name: "Manual edit",
      file_hash: `manual-edit:${projectUuid}`,
      row_number: 1,
      raw_row: {},
    },
    { onConflict: "file_hash,row_number" },
  );
  if (error) return error.message;
  return null;
}

export async function updateProject(
  id: string,
  form: ProjectFormData,
): Promise<{ ok: true } | { error: string }> {
  try {
    const db = createServerSupabase();

    const { data: project, error: loadErr } = await loadProjectForAction(db, id);
    if (loadErr) return { error: loadErr.message };
    const projectId = project?.project_id ? String(project.project_id) : id;
    const installer =
      project?.installer != null
        ? String(project.installer)
        : (form.installer?.trim() || null);

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

    if (project?.project_id) {
      const { error } = await db.from("projects").update(projectUpdate).eq("project_id", projectId);
      if (error) return { error: error.message };

      const remittanceErr = await saveLatestRemittance(db, id, projectId, form);
      if (remittanceErr) return { error: remittanceErr };
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

    if (project?.project_id) await refreshNetEpcForProjects(db, [id]);

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
    const db = createServerSupabase();
    const { data: project, error: loadErr } = await loadProjectForAction(db, id);
    if (loadErr) return { error: loadErr.message };
    const projectId = project?.project_id ? String(project.project_id) : id;

    await deletePublicDealFromHub({
      installer:
        project?.installer != null ? String(project.installer) : installerHint ?? null,
      projectId,
    });

    if (project?.project_id) {
      const { error } = await db.from("projects").delete().eq("project_id", projectId);
      if (error) return { error: error.message };
    }
    revalidatePath("/projects");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed." };
  }
}
