/** Hub project_stage / remittance status → Sequifi job_status */

const HUB_TO_SEQUIFI: Readonly<Record<string, string>> = {
  paused: "Pending",
  design: "Pending",
  "notice to proceed": "Pending",
  permitting: "Pending",
  "install scheduled": "Pending",
  "site survey": "Pending",
  preconstruction: "Pending",
  "inspection scheduled": "Serviced",
  canceled: "Canceled",
};

const CANCELED_ALIASES = new Set(["cancel", "cancelled", "canceled"]);

function normalizeHubStage(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map a hub stage to Sequifi job_status, or null if unmapped. */
export function toSequifiJobStatus(
  hubStage: string | null | undefined,
): string | null {
  const raw = hubStage?.trim();
  if (!raw) return null;

  const key = normalizeHubStage(raw);
  if (HUB_TO_SEQUIFI[key]) return HUB_TO_SEQUIFI[key]!;

  if (CANCELED_ALIASES.has(key) || key.startsWith("cancel")) return "Canceled";

  return null;
}

export function resolveSequifiJobStatus(
  projectStage: string | null | undefined,
  remittanceStatus: string | null | undefined,
  isNew: boolean,
): string | null {
  const fromStage = toSequifiJobStatus(projectStage);
  if (fromStage) return fromStage;

  const fromRemit = toSequifiJobStatus(remittanceStatus);
  if (fromRemit) return fromRemit;

  if (isNew) return "Pending";
  return null;
}
