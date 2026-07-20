import {
  compactPublicDealObject,
  deletePublicDeal,
  findPublicDealByProjectId,
  installerToPublicDealVendor,
  patchPublicDeal,
  putPublicDeal,
  type PublicDealPayload,
} from "@/lib/public-deals/client";

export type PublicDealSyncInput = {
  installer?: string | null;
  project: Record<string, unknown>;
  remittance?: Record<string, unknown>;
  vendorKey?: Record<string, unknown>;
  source?: {
    fileName?: string | null;
    rowNumber?: number;
    rawRow?: Record<string, unknown>;
  };
};

function compactProjectPayload(project: Record<string, unknown>) {
  const payload = compactPublicDealObject(project);
  // Installer selects the vendor endpoint; it is not part of the endpoint's
  // supported nested project schema.
  delete payload.installer;
  return payload;
}

export async function syncPublicDealFromHub(input: PublicDealSyncInput) {
  const installer =
    input.installer ??
    (typeof input.project.installer === "string" ? input.project.installer : null);
  const project = compactProjectPayload(input.project);
  if (!project.project_id) {
    throw new Error("Project ID is required for public deals sync");
  }

  const existing = !installer
    ? await findPublicDealByProjectId(String(project.project_id))
    : null;
  const vendor = installerToPublicDealVendor(installer) ?? existing?.vendor ?? null;
  if (!vendor) {
    throw new Error(
      installer
        ? `No public deals vendor mapping for installer "${installer}"`
        : "Installer is required for public deals sync",
    );
  }

  // Lovable's PUT endpoint fully replaces the `remittance` JSON blob rather
  // than merging it, so omit the key entirely when we have nothing to write
  // — sending `remittance: {}` would silently wipe out any previously
  // backfilled remittance fields (e.g. pv_size) on every routine sync.
  const remittance = input.remittance
    ? compactPublicDealObject(input.remittance)
    : undefined;

  const payload: PublicDealPayload = {
    vendor_key:
      input.vendorKey ??
      (vendor === "illum" && typeof project.project_id === "string"
        ? { deal_id: project.project_id.replace(/^hubspot_/, "") }
        : undefined),
    project,
    remittance,
    source: {
      file_name: input.source?.fileName ?? undefined,
      row_number: input.source?.rowNumber,
      raw_row: input.source?.rawRow,
    },
  };

  return putPublicDeal(vendor, payload);
}

export async function patchPublicDealFromHub(input: PublicDealSyncInput) {
  const installer =
    input.installer ??
    (typeof input.project.installer === "string" ? input.project.installer : null);
  const project = compactProjectPayload(input.project);
  const projectId = typeof project.project_id === "string" ? project.project_id.trim() : "";
  if (!projectId) throw new Error("Project ID is required for public deals sync");

  const existing = !installer ? await findPublicDealByProjectId(projectId) : null;
  const vendor = installerToPublicDealVendor(installer) ?? existing?.vendor ?? null;
  if (!vendor) {
    throw new Error(
      installer
        ? `No public deals vendor mapping for installer "${installer}"`
        : "Installer is required for public deals sync",
    );
  }

  // Same reasoning as syncPublicDealFromHub: never send an empty remittance
  // object, since Lovable replaces (not merges) it on write.
  const payload: PublicDealPayload = {
    project,
    remittance: input.remittance
      ? compactPublicDealObject(input.remittance)
      : undefined,
    source: {
      file_name: input.source?.fileName ?? undefined,
      row_number: input.source?.rowNumber,
      raw_row: input.source?.rawRow,
    },
  };

  return patchPublicDeal(vendor, projectId, payload);
}

export async function deletePublicDealFromHub(input: {
  installer?: string | null;
  projectId: string;
}) {
  const existing = !input.installer
    ? await findPublicDealByProjectId(input.projectId)
    : null;
  const vendor = installerToPublicDealVendor(input.installer) ?? existing?.vendor ?? null;
  if (!vendor) {
    throw new Error(
      input.installer
        ? `No public deals vendor mapping for installer "${input.installer}"`
        : "Installer is required for public deals delete",
    );
  }
  return deletePublicDeal(vendor, input.projectId);
}
