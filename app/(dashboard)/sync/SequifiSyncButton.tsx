"use client";

import { useState, useTransition } from "react";
import { syncWithSequifi, type SequifiSyncResult } from "./sequifi-actions";
import { applySequifiSync } from "@/lib/sequifi/sync-client";

export default function SequifiSyncButton() {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"preview" | "apply" | null>(null);
  const [result, setResult] = useState<SequifiSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(dryRun: boolean) {
    setResult(null);
    setError(null);
    setMode(dryRun ? "preview" : "apply");
    startTransition(async () => {
      const res = dryRun
        ? await syncWithSequifi({ dryRun: true })
        : await applySequifiSync();
      if ("error" in res) setError(res.error);
      else setResult(res);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sync with Sequifi</h2>
        <p className="mt-1 text-sm text-slate-500">
          Links projects to Sequifi sales by PID then customer name, pushes app
          data to Sequifi (updates linked sales, creates missing ones), and pulls
          Sequifi-only sales into the hub. Supabase is the source of truth. Run
          Preview first to see what will change.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => run(true)}
            disabled={pending}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending && mode === "preview" ? "Previewing…" : "Preview (dry run)"}
          </button>
          <button
            onClick={() => run(false)}
            disabled={pending}
            className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {pending && mode === "apply" ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Syncing…
              </span>
            ) : (
              "Apply sync"
            )}
          </button>
          {pending && (
            <p className="text-sm text-slate-500">
              {mode === "apply"
                ? "Pushing to Sequifi… this may take a few minutes. Keep this tab open."
                : "Reconciling projects with Sequifi sales…"}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            {result.dryRun ? "Preview — nothing was written" : "Sync results"}
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            {result.projectsScanned.toLocaleString()} projects ·{" "}
            {result.sequifiSales.toLocaleString()} Sequifi sales
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={result.dryRun ? "Would update in Sequifi" : "Updated in Sequifi"} value={result.pushedUpdate} color="emerald" />
            <Stat label={result.dryRun ? "Would create in Sequifi" : "Created in Sequifi"} value={result.pushedNew} color="emerald" />
            <Stat label={result.dryRun ? "Would pull into hub" : "Pulled into hub"} value={result.pulledNew} color="cyan" />
            <Stat label="Linked to existing" value={result.linkedExisting} color="slate" />
            <Stat label="Ambiguous (skipped)" value={result.ambiguous} color="amber" />
            <Stat label="Missing fields (skipped)" value={result.skippedMissingFields} color="amber" />
            <Stat label="Errors" value={result.errors} color={result.errors > 0 ? "red" : "slate"} />
          </div>

          <SampleList title="Update samples" items={result.samples.update} />
          <SampleList title="Create samples" items={result.samples.create} />
          <SampleList title="Pull samples" items={result.samples.pull} />

          {result.errorMessages.length > 0 && (
            <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {result.errorMessages.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SampleList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <ul className="space-y-0.5 text-xs text-slate-600">
        {items.map((it, i) => (
          <li key={i} className="font-mono">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: number;
  color?: "slate" | "emerald" | "cyan" | "amber" | "red";
}) {
  const colors = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-800",
    cyan: "bg-cyan-50 text-cyan-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-800",
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs font-medium">{label}</p>
    </div>
  );
}
