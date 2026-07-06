"use client";

import { useCallback, useState, useTransition } from "react";
import CsvDropZone from "@/components/ui/CsvDropZone";
import InstallerSelect from "@/components/ui/InstallerSelect";
import {
  detectImportSourceFromCsv,
  IMPORT_SOURCE_LABELS,
  type ImportSource,
} from "@/lib/data-hub/normalize";
import { parseCsv, rowsToRecords } from "@/lib/csv/parse";
import { uploadImportFile } from "./actions";

const ENABLED_SOURCES: ImportSource[] = ["projects_sheet", "remittance"];

export default function ImportUploadForm({ installers }: { installers: string[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [source, setSource] = useState<ImportSource>("projects_sheet");
  const [installer, setInstaller] = useState("");
  const [autoDetected, setAutoDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [rowEstimate, setRowEstimate] = useState<number | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setDetecting(true);
    try {
      const text = await file.text();
      const detected = detectImportSourceFromCsv(text, file.name);
      const resolved =
        ENABLED_SOURCES.includes(detected) ? detected : "projects_sheet";
      setSource(resolved);
      setAutoDetected(true);
      setRowEstimate(rowsToRecords(parseCsv(text)).length);
    } finally {
      setDetecting(false);
    }
  }, []);

  const resetFormState = () => {
    setSource("projects_sheet");
    setInstaller("");
    setAutoDetected(false);
    setRowEstimate(null);
    setFileKey((k) => k + 1);
  };

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("source", source);
        if (installer) fd.set("installer", installer);
        startTransition(async () => {
          const res = await uploadImportFile(fd);
          if ("error" in res) {
            setError(res.error);
            return;
          }
          const label = IMPORT_SOURCE_LABELS[res.source as ImportSource] ?? res.source;
          const detail =
            res.source === "remittance"
              ? `${res.updated} endpoint rows updated, ${res.matched} linked to projects${res.errors ? `, ${res.errors} errors` : ""}.`
              : `${res.inserted} new, ${res.updated} updated${res.errors ? `, ${res.errors} errors` : ""}.`;
          setResult(`Imported ${res.rowCount} rows (${label}): ${detail}`);
          if (res.errorMessages.length) {
            setError(res.errorMessages.join("\n"));
          }
          form.reset();
          resetFormState();
        });
      }}
    >
      <h2 className="text-lg font-semibold text-slate-900">Upload CSV</h2>
      <p className="mt-1 text-sm text-slate-500">
        Drop a file — source type is auto-detected from columns and filename.
        Override below if needed.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            CSV file
          </label>
          <CsvDropZone
            name="file"
            required
            disabled={pending}
            resetKey={fileKey}
            onFileSelect={handleFileSelect}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Source</label>
            {detecting && (
              <span className="text-xs text-slate-400">Detecting…</span>
            )}
            {!detecting && autoDetected && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                Auto-detected
              </span>
            )}
          </div>
          <select
            name="source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as ImportSource);
              setAutoDetected(false);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {ENABLED_SOURCES.map((s) => (
              <option key={s} value={s}>
                {IMPORT_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
          {autoDetected && (
            <p className="mt-1 text-xs text-slate-500">
              Detected as {IMPORT_SOURCE_LABELS[source]}. Change manually if
              incorrect.
            </p>
          )}
        </div>

        {source === "projects_sheet" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Installer
            </label>
            <InstallerSelect
              options={installers}
              value={installer}
              onChange={setInstaller}
              allowCustom={false}
              placeholder="Apply to all rows (optional)…"
            />
            <p className="mt-1 text-xs text-slate-500">
              Sets installer on every project row in this file.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || detecting}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? "Importing…" : "Upload & import"}
        </button>

        {pending && (
          <div
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 font-medium">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"
                aria-hidden
              />
              {rowEstimate != null
                ? `Importing ${rowEstimate} rows…`
                : "Importing…"}
            </div>
            <p className="mt-1 text-xs text-orange-800">
              Saving to the installer endpoints. Please keep this tab
              open until the import finishes.
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {result}
        </div>
      )}
      {error && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </pre>
      )}
    </form>
  );
}
