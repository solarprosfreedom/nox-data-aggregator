"use client";

import { useState, useTransition } from "react";
import { syncSettersFromTerros } from "@/app/(dashboard)/sync/actions";
import { IconSync } from "@/components/ui/icons";

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
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Syncing…
          </>
        ) : (
          <>
            <IconSync size={16} className="text-slate-500" />
            Sync setter &amp; closer
          </>
        )}
      </button>
      {status && (
        <span className={`max-w-xs truncate text-xs ${isError ? "text-red-600" : "text-slate-500"}`}>
          {status}
        </span>
      )}
    </div>
  );
}
