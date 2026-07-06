"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { syncWithSequifi } from "@/app/(dashboard)/sync/sequifi-actions";
import { applySequifiSync } from "@/lib/sequifi/sync-client";

type Status = { text: string; ok: boolean } | null;

export default function SequifiSyncInlineButton() {
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function run(dryRun: boolean) {
    setMenuOpen(false);
    setStatus(null);
    startTransition(async () => {
      const res = dryRun
        ? await syncWithSequifi({ dryRun: true })
        : await applySequifiSync();
      if ("error" in res) {
        setStatus({ text: res.error, ok: false });
      } else {
        const parts = [
          res.pushedUpdate ? `${res.pushedUpdate} updated` : null,
          res.pushedNew ? `${res.pushedNew} created` : null,
          res.pulledNew ? `${res.pulledNew} pulled` : null,
          res.errors ? `${res.errors} errors` : null,
        ].filter(Boolean);
        setStatus({
          text: `${dryRun ? "Preview — " : ""}${parts.join(" · ") || "Nothing to sync"}`,
          ok: res.errors === 0,
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          ) : (
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {pending ? "Syncing…" : "Sync Sequifi"}
          {!pending && (
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => run(true)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div>
                <p className="font-medium">Preview</p>
                <p className="text-xs text-slate-400">Dry run — no changes</p>
              </div>
            </button>
            <div className="mx-3 my-1 border-t border-slate-100" />
            <button
              onClick={() => run(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <div>
                <p className="font-medium">Apply sync</p>
                <p className="text-xs text-slate-400">Push & pull changes</p>
              </div>
            </button>
          </div>
        )}
      </div>

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
