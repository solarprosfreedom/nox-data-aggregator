"use client";

import { useState, useTransition } from "react";
import { syncSettersFromTerros } from "@/app/(dashboard)/sync/actions";

export default function SyncSettersButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSync() {
    setStatus(null);
    setIsError(false);
    startTransition(async () => {
      const res = await syncSettersFromTerros();
      if ("error" in res) {
        setStatus(res.error);
        setIsError(true);
      } else {
        setStatus(`${res.updated} updated · ${res.matched} matched (${res.matchedByEmail} email, ${res.matchedByPhone} phone, ${res.matchedByAddress} address) · ${res.unmatched} unmatched`);
        setIsError(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Syncing…
          </>
        ) : (
          <>
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync setter &amp; closer
          </>
        )}
      </button>
      {status && (
        <span className={`text-xs ${isError ? "text-red-600" : "text-slate-500"}`}>
          {status}
        </span>
      )}
    </div>
  );
}
