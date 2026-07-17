import {
  fetchAllSequifiSales,
  upsertSequifiSales,
  type SequifiUpsertRecord,
} from "@/lib/sequifi/client";
import {
  buildSalesIndex,
  matchProjectToSale,
} from "@/lib/sequifi/matcher";
import {
  buildSequifiExistingUpdateRecord,
  buildSequifiUpsertRecord,
} from "@/lib/sequifi/build-upsert-record";
import {
  listEndpointProjectsFresh,
  type RemittanceSummary,
} from "@/lib/data-hub/queries";
import { patchPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";

type ProjectRow = {
  id: string;
  project_id: string | null;
  opportunity_name: string | null;
  sequifi_pid: string | null;
  state_code: string | null;
  address_line1: string | null;
  postal_code: string | null;
  system_size_kw: number | null;
  total_system_cost: number | null;
  contract_signed_date: string | null;
  installer: string | null;
  project_stage: string | null;
  net_epc: number | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  closer_email: string | null;
  sales_advisor_name: string | null;
  sales_advisor_email: string | null;
  setter_sequifi_employee_id: string | null;
  closer_sequifi_employee_id: string | null;
};

export type SequifiSyncResult = {
  dryRun: boolean;
  projectsScanned: number;
  sequifiSales: number;
  pushedUpdate: number;
  pushedNew: number;
  linkedExisting: number;
  ambiguous: number;
  /** New deals that cannot satisfy Sequifi's Solar insert validation. */
  skippedMissingFields: number;
  /** Existing PIDs with no non-empty source values available to merge. */
  skippedEmptyUpdates: number;
  errors: number;
  errorMessages: string[];
  samples: { update: string[]; create: string[] };
};

export type SequifiSyncResponse = SequifiSyncResult | { error: string };

export type SequifiSyncAuditEntry = {
  projectId: string;
  opportunityName: string | null;
  sequifiPid: string;
  action: "created" | "updated";
  sequifiApplied: true;
  sourceLinked: boolean;
  sourceLinkError?: string;
  syncedAt: string;
};

const LINK_PARALLEL = 40;

async function linkPushedProjects(
  pushApply: {
    projectId: string;
    installer: string | null;
    pid: string;
    isNew: boolean;
    opportunityName: string | null;
    sequifi_job_status: string | null;
  }[],
  succeededPids: Set<string>,
  syncedAt: string,
): Promise<{
  pushedNew: number;
  pushedUpdate: number;
  errors: { id: string; message: string }[];
  audit: SequifiSyncAuditEntry[];
}> {
  const toLink = pushApply.filter((item) => succeededPids.has(item.pid));
  let pushedNew = 0;
  let pushedUpdate = 0;
  const errors: { id: string; message: string }[] = [];
  const audit: SequifiSyncAuditEntry[] = [];

  for (let i = 0; i < toLink.length; i += LINK_PARALLEL) {
    const chunk = toLink.slice(i, i + LINK_PARALLEL);
    const results = await Promise.all(
      chunk.map(async (item) => {
        try {
          await patchPublicDealFromHub({
            installer: item.installer,
            project: {
              project_id: item.projectId,
              sequifi_pid: item.pid,
              sequifi_job_status: item.sequifi_job_status,
              sequifi_synced_at: syncedAt,
            },
          });
          return { item, error: null };
        } catch (error) {
          return {
            item,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }),
    );

    for (const { item, error } of results) {
      if (error) {
        errors.push({ id: item.projectId, message: error.message });
        audit.push({
          projectId: item.projectId,
          opportunityName: item.opportunityName,
          sequifiPid: item.pid,
          action: item.isNew ? "created" : "updated",
          sequifiApplied: true,
          sourceLinked: false,
          sourceLinkError: error.message,
          syncedAt,
        });
      } else {
        if (item.isNew) pushedNew++;
        else pushedUpdate++;
        audit.push({
          projectId: item.projectId,
          opportunityName: item.opportunityName,
          sequifiPid: item.pid,
          action: item.isNew ? "created" : "updated",
          sequifiApplied: true,
          sourceLinked: true,
          syncedAt,
        });
      }
    }
  }

  return { pushedNew, pushedUpdate, errors, audit };
}

export async function runSequifiSync({
  dryRun,
  onApplied,
}: {
  dryRun: boolean;
  /** Receives each confirmed Sequifi write after its source deal is linked. */
  onApplied?: (entries: SequifiSyncAuditEntry[]) => void | Promise<void>;
}): Promise<SequifiSyncResponse> {
  const result: SequifiSyncResult = {
    dryRun,
    projectsScanned: 0,
    sequifiSales: 0,
    pushedUpdate: 0,
    pushedNew: 0,
    linkedExisting: 0,
    ambiguous: 0,
    skippedMissingFields: 0,
    skippedEmptyUpdates: 0,
    errors: 0,
    errorMessages: [],
    samples: { update: [], create: [] },
  };

  try {
    const projects = (await listEndpointProjectsFresh()) as Array<
      ProjectRow & { remittance: RemittanceSummary | null }
    >;
    result.projectsScanned = projects.length;

    const remittanceByProject = new Map<string, RemittanceSummary | null>();
    for (const project of projects) {
      if (project.project_id) remittanceByProject.set(project.project_id, project.remittance);
    }

    const sales = await fetchAllSequifiSales();
    result.sequifiSales = sales.length;
    const index = buildSalesIndex(sales);

    const pushRecords: SequifiUpsertRecord[] = [];
    const pushApply: {
      projectId: string;
      installer: string | null;
      pid: string;
      isNew: boolean;
      opportunityName: string | null;
      sequifi_job_status: string | null;
    }[] = [];

    for (const p of projects) {
      const m = matchProjectToSale(p, index);

      if (m.kind === "ambiguous") {
        result.ambiguous++;
        continue;
      }

      if (m.kind === "matched") {
        result.linkedExisting++;
        const pid = m.sale.pid;
        const rec = buildSequifiExistingUpdateRecord(
          p,
          pid,
          p.project_id ? remittanceByProject.get(p.project_id) ?? null : null,
        );
        if (!rec) {
          result.skippedEmptyUpdates++;
          continue;
        }
        pushRecords.push(rec);
        pushApply.push({
          projectId: p.project_id ?? p.id,
          installer: p.installer,
          pid,
          isNew: false,
          opportunityName: p.opportunity_name,
          sequifi_job_status: rec.job_status ?? m.sale.job_status,
        });
        if (result.samples.update.length < 10) {
          result.samples.update.push(`${p.project_id} -> pid ${pid} (${p.opportunity_name})`);
        }
      } else {
        const pid = p.project_id?.trim();
        const rec = pid
          ? buildSequifiUpsertRecord(
              p,
              pid,
              true,
              remittanceByProject.get(pid) ?? null,
            )
          : null;
        if (!pid || !rec) {
          result.skippedMissingFields++;
          continue;
        }
        pushRecords.push(rec);
        pushApply.push({
          projectId: pid,
          installer: p.installer,
          pid,
          isNew: true,
          opportunityName: p.opportunity_name,
          sequifi_job_status: rec.job_status ?? "Signed",
        });
        if (result.samples.create.length < 10) {
          result.samples.create.push(`${pid} (${p.opportunity_name})`);
        }
      }
    }

    if (dryRun) {
      result.pushedUpdate = pushApply.filter((x) => !x.isNew).length;
      result.pushedNew = pushApply.filter((x) => x.isNew).length;
      return result;
    }

    if (pushRecords.length) {
      const outcome = await upsertSequifiSales(pushRecords);
      result.errors += outcome.errors.length;
      for (const e of outcome.errors) {
        if (result.errorMessages.length < 15) {
          result.errorMessages.push(`push ${e.pid}: ${e.message}`);
        }
      }

      const syncedAt = new Date().toISOString();
      const linked = await linkPushedProjects(
        pushApply,
        outcome.succeededPids,
        syncedAt,
      );
      result.pushedNew = linked.pushedNew;
      result.pushedUpdate = linked.pushedUpdate;
      result.errors += linked.errors.length;
      for (const e of linked.errors) {
        if (result.errorMessages.length < 15) {
          result.errorMessages.push(`link ${e.id}: ${e.message}`);
        }
      }
      if (linked.audit.length && onApplied) {
        try {
          await onApplied(linked.audit);
        } catch (error) {
          result.errors++;
          if (result.errorMessages.length < 15) {
            result.errorMessages.push(
              `audit log: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }

    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sequifi sync failed." };
  }
}
