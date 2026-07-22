import {
  PUBLIC_DEAL_VENDORS,
  listAllPublicDealsCached,
  type PublicDealRow,
  type PublicDealVendor,
} from "@/lib/public-deals/client";
import {
  mapPublicDealRow,
  type ProjectWithRemittance,
} from "@/lib/data-hub/queries";

export type CountStat = {
  label: string;
  count: number;
};

export type InstallerDashboardStat = {
  vendor: PublicDealVendor;
  label: string;
  count: number;
  withRemittance: number;
  latestUpdated: string | null;
};

export type DashboardStats = {
  totalProjects: number;
  withRemittance: number;
  installerStats: InstallerDashboardStat[];
  stageStats: CountStat[];
};

const VENDOR_LABELS: Record<PublicDealVendor, string> = {
  axia: "Axia",
  illum: "Illum",
  tron: "Tron",
  empwr: "Empwr",
  goodpwr: "GoodPwr",
  owe: "OWE",
};

function addCount(map: Map<string, number>, rawLabel: string | null | undefined) {
  const label = rawLabel?.trim() || "Not set";
  map.set(label, (map.get(label) ?? 0) + 1);
}

function dashboardStageLabel(rawLabel: string | null | undefined) {
  const label = rawLabel?.trim();
  if (!label) return null;
  const normalized = label.toLowerCase();
  const stageKey = normalized.replace(/^[✓✔]\s*/, "");
  if (stageKey === "install" || stageKey === "installation") return "Installation";
  if (stageKey === "cancelled" || stageKey === "canceled") return "Cancelled";
  if (stageKey === "notice to proceed" || stageKey === "ntp") {
    return "Notice to Proceed";
  }
  return label;
}

function sortedCounts(map: Map<string, number>): CountStat[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function laterIso(current: string | null, candidate: string | null | undefined) {
  const nextTime = Date.parse(candidate ?? "");
  if (!Number.isFinite(nextTime) || nextTime <= 0) return current;

  const currentTime = Date.parse(current ?? "");
  if (!Number.isFinite(currentTime) || nextTime > currentTime) {
    return new Date(nextTime).toISOString();
  }
  return current;
}

export function buildDashboardStats(rows: PublicDealRow[]): DashboardStats {
  const installerStats = new Map<PublicDealVendor, InstallerDashboardStat>(
    PUBLIC_DEAL_VENDORS.map((vendor) => [
      vendor,
      {
        vendor,
        label: VENDOR_LABELS[vendor],
        count: 0,
        withRemittance: 0,
        latestUpdated: null,
      },
    ]),
  );

  const stageCounts = new Map<string, number>();
  let withRemittance = 0;

  for (const row of rows) {
    const project = mapPublicDealRow(row);
    const installer = installerStats.get(row.vendor);
    if (!installer) continue;

    const hasRemittance = project.remittance != null;

    installer.count++;
    installer.latestUpdated = laterIso(installer.latestUpdated, project.updated_at);
    if (hasRemittance) installer.withRemittance++;

    if (hasRemittance) withRemittance++;

    addCount(stageCounts, dashboardStageLabel(project.project_stage));
  }

  return {
    totalProjects: rows.length,
    withRemittance,
    installerStats: PUBLIC_DEAL_VENDORS.map((vendor) => installerStats.get(vendor)!),
    stageStats: sortedCounts(stageCounts),
  };
}

export async function getDashboardStats() {
  const rows = await listAllPublicDealsCached();
  return buildDashboardStats(rows);
}
