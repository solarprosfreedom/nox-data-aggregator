"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CsvDropZone from "@/components/ui/CsvDropZone";
import {
  detectImportSourceFromCsv,
  IMPORT_SOURCE_LABELS,
  type ImportSource,
} from "@/lib/data-hub/normalize";
import { uploadSampleCsv } from "./actions";

export default function SampleUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<ImportSource>("projects_sheet");
  const [autoDetected, setAutoDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setDetecting(true);
    try {
      const text = await file.text();
      const detected = detectImportSourceFromCsv(text, file.name);
      setSourceType(detected);
      setAutoDetected(true);
    } finally {
      setDetecting(false);
    }
  }, []);

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("source_type", sourceType);
        startTransition(async () => {
          const res = await uploadSampleCsv(fd);
          if ("error" in res) {
            setError(res.error);
            return;
          }
          form.reset();
          router.push(`/samples/${res.id}`);
        });
      }}
    >
      <h2 className="text-lg font-semibold text-slate-900">Upload sample CSV</h2>
      <p className="mt-1 text-sm text-slate-500">
        Store reference files for column mapping. Samples are not imported into
        projects.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Label
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder="Axia daily - June 2026"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            CSV file
          </label>
          <CsvDropZone
            name="file"
            required
            disabled={pending}
            onFileSelect={handleFileSelect}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Source type
              </label>
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
              name="source_type"
              required
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as ImportSource);
                setAutoDetected(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="projects_sheet">Projects sheet</option>
              <option value="terros_export">Terros export</option>
              <option value="remittance">Remittance</option>
            </select>
            {autoDetected && (
              <p className="mt-1 text-xs text-slate-500">
                Detected as {IMPORT_SOURCE_LABELS[sourceType]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Installer (optional)
            </label>
            <input
              name="installer"
              type="text"
              placeholder="Axia, Tron, …"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Column quirks, date received, etc."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending || detecting}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Save sample"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
