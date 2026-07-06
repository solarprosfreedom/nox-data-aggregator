"use client";

import { useState, useTransition } from "react";
import { syncSettersFromTerros, type SyncResult } from "./actions";

export default function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await syncSettersFromTerros();
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sync setter &amp; closer from Terros</h2>
        <p className="mt-1 text-sm text-slate-500">
          Matches projects to the synced Terros accounts by email, phone, or
          normalized address (in that order) and writes the Terros owner as the
          setter and the Terros closer as the closer.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={handleSync}
            disabled={pending}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Syncing…
              </span>
            ) : (
              "Sync setter & closer now"
            )}
          </button>
          {pending && (
            <p className="text-sm text-slate-500">
              Matching projects against synced Terros accounts…
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
          <h2 className="mb-4 text-base font-semibold text-slate-900">Sync results</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Projects scanned"     value={result.projectsScanned} />
            <Stat label="Terros accounts"      value={result.terrosAccounts}   color="slate" />
            <Stat label="Matched"              value={result.matched}          color="emerald" />
            <Stat label="Updated"              value={result.updated}          color="emerald" />
            <Stat label="Newly filled"         value={result.filled}           color="emerald" />
            <Stat label="Changed existing"     value={result.changed}          color="orange" />
            <Stat label="Matched by email"     value={result.matchedByEmail}   color="orange" />
            <Stat label="Matched by phone"     value={result.matchedByPhone}   color="orange" />
            <Stat label="Matched by address"   value={result.matchedByAddress} color="orange" />
            <Stat label="No setter in Terros"  value={result.noSetterInTerros} color="amber" />
            <Stat label="No match found"       value={result.unmatched}        color="amber" />
            <Stat label="Errors"               value={result.errors}           color={result.errors > 0 ? "red" : "slate"} />
          </div>

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

function Stat({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: number;
  color?: "slate" | "emerald" | "orange" | "amber" | "red";
}) {
  const colors = {
    slate:   "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-800",
    orange:    "bg-orange-50 text-orange-800",
    amber:   "bg-amber-50 text-amber-800",
    red:     "bg-red-50 text-red-800",
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs font-medium">{label}</p>
    </div>
  );
}
