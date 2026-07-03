import {
  compactPublicDealObject,
  deletePublicDeal,
  installerToPublicDealVendor,
  patchPublicDeal,
  putPublicDeal,
  type PublicDealPayload,
} from "@/lib/public-deals/client";

export type PublicDealSyncInput = {
  installer?: string | null;
  project: Record<string, unknown>;
  remittance?: Record<string, unknown>;
  source?: {
    fileName?: string | null;
    rowNumber?: number;
    rawRow?: Record<string, unknown>;
  };
};

export async function syncPublicDealFromHub(input: PublicDealSyncInput) {
  const installer =
    input.installer ??
    (typeof input.project.installer === "string" ? input.project.installer : null);
  const vendor = installerToPublicDealVendor(installer);
  if (!vendor) {
    throw new Error(
      installer
        ? `No public deals vendor mapping for installer "${installer}"`
        : "Installer is required for public deals sync",
    );
  }

  const project = compactPublicDealObject(input.project);
  if (!project.project_id) {
    throw new Error("Project ID is required for public deals sync");
  }

  const remittance = input.remittance
    ? compactPublicDealObject(input.remittance)
    : {};

  const payload: PublicDealPayload = {
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
  const vendor = installerToPublicDealVendor(installer);
  if (!vendor) {
    throw new Error(
      installer
        ? `No public deals vendor mapping for installer "${installer}"`
        : "Installer is required for public deals sync",
    );
  }

  const project = compactPublicDealObject(input.project);
  const projectId = typeof project.project_id === "string" ? project.project_id.trim() : "";
  if (!projectId) throw new Error("Project ID is required for public deals sync");

  const payload: PublicDealPayload = {
    project,
    remittance: input.remittance
      ? compactPublicDealObject(input.remittance)
      : {},
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
  const vendor = installerToPublicDealVendor(input.installer);
  if (!vendor) {
    throw new Error(
      input.installer
        ? `No public deals vendor mapping for installer "${input.installer}"`
        : "Installer is required for public deals delete",
    );
  }
  return deletePublicDeal(vendor, input.projectId);
}
