"use client";

import { useState, useTransition } from "react";
import { applySequifiSync } from "@/lib/sequifi/sync-client";

type Status = { text: string; ok: boolean } | null;

export default function SequifiSyncInlineButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);

  function run() {
    setStatus(null);
    startTransition(async () => {
      const res = await applySequifiSync();
      if ("error" in res) {
        setStatus({ text: res.error, ok: false });
      } else {
        const parts = [
          res.pushedUpdate ? `${res.pushedUpdate} updated` : null,
          res.pushedNew ? `${res.pushedNew} created` : null,
          res.errors ? `${res.errors} errors` : null,
        ].filter(Boolean);
        setStatus({
          text: parts.join(" · ") || "Nothing to sync",
          ok: res.errors === 0,
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        ) : (
          <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        {pending ? "Syncing…" : "Sync Sequifi"}
      </button>

      {status && (
        <span className={`max-w-xs truncate rounded-full px-2.5 py-1 text-xs font-medium ${
          status.ok
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}>
          {status.text}
        </span>
      )}
    </div>
  );
}
