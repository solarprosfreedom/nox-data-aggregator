/** Sequifi job_status values (free-text on their side; these are our canonical labels). */
export const SEQUIFI_JOB_STATUSES = [
  "Signed",
  "Survey Scheduled",
  "Survey Complete",
  "Design",
  "Permit",
  "Install",
  "Inspection",
  "PTO",
  "Canceled",
] as const;

export type SequifiJobStatus = (typeof SEQUIFI_JOB_STATUSES)[number];

const HUB_TO_SEQUIFI: Readonly<Record<string, SequifiJobStatus>> = {
  "closed won": "Signed",
  signed: "Signed",
  deal: "Signed",
  "sales handoff": "Signed",
  paid: "Signed",

  "site survey": "Survey Scheduled",
  "project intake": "Survey Scheduled",
  "survey scheduled": "Survey Scheduled",

  "survey complete": "Survey Complete",

  design: "Design",
  engineering: "Design",
  preconstruction: "Design",
  initiation: "Design",
  paused: "Design",
  hold: "Design",

  permitting: "Permit",
  "notice to proceed": "Permit",
  "pending ntp": "Permit",
  "pending ntp - change order": "Permit",
  "pending ntp - wc needed": "Permit",
  "permit packet complete": "Permit",
  "✔ ntp": "Permit",

  install: "Install",
  installation: "Install",
  "install scheduled": "Install",

  inspection: "Inspection",
  "inspection scheduled": "Inspection",

  pto: "PTO",
  "pto submitted": "PTO",
  completed: "PTO",
  interconnection: "PTO",

  canceled: "Canceled",
  cancelled: "Canceled",
  cancel: "Canceled",
  "closed lost": "Canceled",
};

const CANONICAL_BY_KEY = new Map<string, SequifiJobStatus>(
  SEQUIFI_JOB_STATUSES.map((s) => [normalizeHubStage(s), s]),
);

function normalizeHubStage(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function fmtDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.length >= 10 ? v.slice(0, 10) : v;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Map a hub stage to Sequifi job_status, or null if unmapped. */
export function toSequifiJobStatus(
  hubStage: string | null | undefined,
): SequifiJobStatus | null {
  const raw = hubStage?.trim();
  if (!raw) return null;

  const key = normalizeHubStage(raw);
  if (HUB_TO_SEQUIFI[key]) return HUB_TO_SEQUIFI[key]!;

  const canonical = CANONICAL_BY_KEY.get(key);
  if (canonical) return canonical;

  if (key.startsWith("cancel")) return "Canceled";

  return null;
}

export function resolveSequifiJobStatus(
  projectStage: string | null | undefined,
  remittanceStatus: string | null | undefined,
  isNew: boolean,
): SequifiJobStatus | null {
  const fromStage = toSequifiJobStatus(projectStage);
  if (fromStage) return fromStage;

  const fromRemit = toSequifiJobStatus(remittanceStatus);
  if (fromRemit) return fromRemit;

  if (isNew) return "Signed";
  return null;
}

export type SequifiJobFields = {
  jobStatus: SequifiJobStatus | null;
  /** Required by Sequifi to actually cancel a sale (job_status alone is display-only). */
  dateCancelled: string | null;
};

export function resolveSequifiJobFields(
  projectStage: string | null | undefined,
  remittanceStatus: string | null | undefined,
  isNew: boolean,
  cancelDate: string | null | undefined,
): SequifiJobFields {
  const jobStatus = resolveSequifiJobStatus(
    projectStage,
    remittanceStatus,
    isNew,
  );
  const dateCancelled =
    jobStatus === "Canceled" ? fmtDate(cancelDate) : null;
  return { jobStatus, dateCancelled };
}
