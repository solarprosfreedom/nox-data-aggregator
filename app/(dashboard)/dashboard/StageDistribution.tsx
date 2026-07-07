"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  columnFilterParamKey,
  encodeColumnFilter,
} from "@/lib/data-hub/column-filters";
import type { CountStat } from "@/lib/data-hub/dashboard-stats";

const numberFormatter = new Intl.NumberFormat("en-US");
const COMPACT_STAGE_LIMIT = 5;

type StageGroup =
  | "Sales"
  | "Design"
  | "Permitting"
  | "Install"
  | "Closed"
  | "Needs stage"
  | "Other";

const STAGE_GROUP_ORDER: StageGroup[] = [
  "Sales",
  "Design",
  "Permitting",
  "Install",
  "Closed",
  "Needs stage",
  "Other",
];

function fmt(value: number) {
  return numberFormatter.format(value);
}

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function MiniBar({
  value,
  total,
  tone = "orange",
}: {
  value: number;
  total: number;
  tone?: "orange" | "slate";
}) {
  const width = total ? Math.max(4, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-slate-100">
      <div
        className={`h-1.5 rounded-full ${tone === "orange" ? "bg-orange-500" : "bg-slate-400"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function stageGroup(label: string): StageGroup {
  const normalized = label.toLowerCase();
  if (normalized === "not set") return "Needs stage";
  if (
    normalized.includes("lost") ||
    normalized.includes("cancel") ||
    normalized.includes("clawback")
  ) {
    return "Closed";
  }
  if (
    normalized.includes("install") ||
    normalized.includes("inspection") ||
    normalized.includes("pto") ||
    normalized.includes("activation")
  ) {
    return "Install";
  }
  if (
    normalized.includes("permit") ||
    normalized.includes("ntp") ||
    normalized.includes("smud") ||
    normalized.includes("approval") ||
    normalized.includes("interconnection")
  ) {
    return "Permitting";
  }
  if (
    normalized.includes("design") ||
    normalized.includes("engineer") ||
    normalized.includes("cad") ||
    normalized.includes("preconstruction") ||
    normalized.includes("production")
  ) {
    return "Design";
  }
  if (
    normalized.includes("won") ||
    normalized.includes("contract") ||
    normalized.includes("sales") ||
    normalized.includes("sent") ||
    normalized.includes("handoff") ||
    normalized.includes("initiation") ||
    normalized.includes("intake") ||
    normalized === "deal" ||
    normalized.includes("funding")
  ) {
    return "Sales";
  }
  return "Other";
}

function stageFilterHref(label: string) {
  const key = columnFilterParamKey("project_stage");
  const params = new URLSearchParams();
  const normalized = label.toLowerCase();

  if (normalized === "not set") {
    params.set(key, encodeColumnFilter({ c1: { op: "isempty", value: "" }, logic: "and" }));
  } else if (normalized === "installation") {
    params.set(
      key,
      encodeColumnFilter({
        c1: { op: "eq", value: "Installation" },
        logic: "or",
        c2: { op: "eq", value: "install" },
      }),
    );
  } else if (normalized === "cancelled") {
    params.set(
      key,
      encodeColumnFilter({
        c1: { op: "eq", value: "Cancelled" },
        logic: "or",
        c2: { op: "eq", value: "cancelled" },
      }),
    );
  } else {
    params.set(key, encodeColumnFilter({ c1: { op: "eq", value: label }, logic: "and" }));
  }

  return `/projects?${params.toString()}`;
}

function compactStageRows(rows: CountStat[]) {
  const selected: CountStat[] = [];
  const selectedLabels = new Set<string>();

  for (const row of rows) {
    if (selected.length >= COMPACT_STAGE_LIMIT) break;
    selected.push(row);
    selectedLabels.add(row.label);
  }

  const notSet = rows.find((row) => row.label === "Not set");
  if (notSet && !selectedLabels.has(notSet.label)) {
    selected.push(notSet);
    selectedLabels.add(notSet.label);
  }

  const otherCount = rows
    .filter((row) => !selectedLabels.has(row.label))
    .reduce((sum, row) => sum + row.count, 0);

  return otherCount > 0
    ? [...selected, { label: "Others", count: otherCount }]
    : selected;
}

function groupedStageRows(rows: CountStat[]) {
  const grouped = new Map<StageGroup, CountStat[]>();
  for (const row of rows) {
    const group = stageGroup(row.label);
    grouped.set(group, [...(grouped.get(group) ?? []), row]);
  }
  return grouped;
}

function StageRow({
  row,
  total,
  onOpen,
}: {
  row: CountStat;
  total: number;
  onOpen: () => void;
}) {
  const isOthers = row.label === "Others";
  const label = isOthers ? (
    <button
      type="button"
      onClick={onOpen}
      className="text-left font-medium text-slate-900 underline-offset-4 hover:text-orange-700 hover:underline"
    >
      Others
    </button>
  ) : (
    <Link
      href={stageFilterHref(row.label)}
      className="font-medium text-slate-900 underline-offset-4 hover:text-orange-700 hover:underline"
    >
      {row.label}
    </Link>
  );

  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm">{label}</p>
        <div className="mt-2">
          <MiniBar value={row.count} total={total} tone={isOthers ? "slate" : "orange"} />
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-900">{fmt(row.count)}</p>
        <p className="text-xs text-slate-400">{pct(row.count, total)}</p>
      </div>
    </div>
  );
}

function StageChip({
  label,
  value,
  total,
  href,
}: {
  label: string;
  value: number;
  total: number;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
          {fmt(value)}
        </p>
      </div>
      <p className="text-xs font-medium text-slate-400">{pct(value, total)}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-colors hover:bg-orange-50/60">
        {content}
      </Link>
    );
  }

  return content;
}

function StageSection({
  group,
  rows,
  total,
}: {
  group: StageGroup;
  rows: CountStat[];
  total: number;
}) {
  const groupTotal = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4 bg-slate-50/70 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {group}
        </h3>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-950">{fmt(groupTotal)}</p>
          <p className="text-[11px] font-medium text-slate-400">{pct(groupTotal, total)}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
            <div className="min-w-0">
              <Link
                href={stageFilterHref(row.label)}
                className="block truncate text-sm font-medium text-slate-900 underline-offset-4 hover:text-orange-700 hover:underline"
              >
                {row.label}
              </Link>
              <div className="mt-2">
                <MiniBar value={row.count} total={total} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950">{fmt(row.count)}</p>
              <p className="text-xs text-slate-400">{pct(row.count, total)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StageModal({
  rows,
  total,
  onClose,
}: {
  rows: CountStat[];
  total: number;
  onClose: () => void;
}) {
  const countByLabel = new Map(rows.map((row) => [row.label, row.count]));
  const notSet = countByLabel.get("Not set") ?? 0;
  const staged = total - notSet;
  const grouped = groupedStageRows(rows);
  const summaryRows = [
    { label: "Staged", value: staged },
    { label: "Not set", value: notSet, href: stageFilterHref("Not set") },
    {
      label: "Installation",
      value: countByLabel.get("Installation") ?? 0,
      href: stageFilterHref("Installation"),
    },
    {
      label: "Permitting",
      value: countByLabel.get("Permitting") ?? 0,
      href: stageFilterHref("Permitting"),
    },
    {
      label: "Cancelled",
      value: countByLabel.get("Cancelled") ?? 0,
      href: stageFilterHref("Cancelled"),
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close stage details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-distribution-title"
        className="relative flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-[#f6f7fb] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              All project stages
            </p>
            <h2 id="stage-distribution-title" className="mt-0.5 text-base font-semibold text-slate-950">
              Stage Distribution
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-800"
          >
            Close
          </button>
        </div>

        <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          {summaryRows.map((row) => (
            <div key={row.label} className="bg-white px-4 py-3">
              <StageChip
                label={row.label}
                value={row.value}
                total={total}
                href={row.href}
              />
            </div>
          ))}
        </div>

        <div className="overflow-auto p-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {STAGE_GROUP_ORDER.map((group) => {
              const groupRows = grouped.get(group) ?? [];
              if (!groupRows.length) return null;
              return (
                <StageSection
                  key={group}
                  group={group}
                  rows={groupRows}
                  total={total}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StageDistribution({
  rows,
  total,
}: {
  rows: CountStat[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const compactRows = useMemo(() => compactStageRows(rows), [rows]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-left text-base font-semibold tracking-tight text-slate-950 underline-offset-4 hover:text-orange-700 hover:underline"
            >
              Project Stages
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 transition hover:bg-orange-100"
          >
            View all
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {compactRows.map((row) => (
            <StageRow
              key={row.label}
              row={row}
              total={total}
              onOpen={() => setOpen(true)}
            />
          ))}
        </div>
      </section>

      {open && <StageModal rows={rows} total={total} onClose={() => setOpen(false)} />}
    </>
  );
}
