"use client";

import { useCallback, useState, useTransition } from "react";
import CsvDropZone from "@/components/ui/CsvDropZone";
import {
  getFields,
  SKIP,
  autoSuggestMapping,
  type SchemaType,
} from "@/lib/data-hub/field-mapper";
import { parseCsv, rowsToRecords, findHeaderRowIndex } from "@/lib/csv/parse";
import { importWithMapping } from "./actions";

type Step = "upload" | "map" | "done";

type ImportResult = {
  inserted: number;
  updated: number;
  errors: number;
  errorMessages: string[];
};

const SCHEMAS: { value: SchemaType; label: string; hint: string }[] = [
  { value: "projects", label: "Projects", hint: "Requires Project ID / HES ID" },
  { value: "remittance", label: "Remittance", hint: "Requires HES Code + Payment Date" },
];

export default function MappingForm() {
  const [step, setStep] = useState<Step>("upload");
  const [fileKey, setFileKey] = useState(0);
  const [schema, setSchema] = useState<SchemaType>("projects");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFileSelect = useCallback(
    async (file: File) => {
      const text = await file.text();
      const rows = parseCsv(text);
      const records = rowsToRecords(rows);

      // Use the same header row that rowsToRecords found
      const headerIdx = findHeaderRowIndex(rows);
      const rawHeaders = rows[headerIdx]?.map((h) => h.trim().replace(/\s+/g, " ")) ?? [];

      // De-duplicate header names (some CSVs repeat column names)
      const deduped = rawHeaders.map((h, i) => {
        const count = rawHeaders.slice(0, i).filter((x) => x === h).length;
        return count > 0 ? `${h} (${count + 1})` : h;
      });

      setCsvContent(text);
      setFileName(file.name);
      setOriginalHeaders(rawHeaders);
      setCsvHeaders(deduped);
      setPreviewRows(records.slice(0, 3));
      setMapping(autoSuggestMapping(deduped, schema));
      setStep("map");
      setResult(null);
      setError(null);
    },
    [schema]
  );

  function handleMappingChange(csvCol: string, fieldKey: string) {
    setMapping((prev) => ({ ...prev, [csvCol]: fieldKey }));
  }

  function handleImport() {
    setError(null);
    const fd = new FormData();
    fd.set("content", csvContent);
    fd.set("fileName", fileName);
    fd.set("schema", schema);
    // Map deduped headers back to original so CSV lookup works
    const resolvedMapping: Record<string, string> = {};
    csvHeaders.forEach((deduped, idx) => {
      const original = originalHeaders[idx] ?? deduped;
      const fieldKey = mapping[deduped] ?? SKIP;
      if (fieldKey !== SKIP) resolvedMapping[original] = fieldKey;
    });
    fd.set("mapping", JSON.stringify(resolvedMapping));

    startTransition(async () => {
      const res = await importWithMapping(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      setStep("done");
    });
  }

  function reset() {
    setStep("upload");
    setFileKey((k) => k + 1);
    setCsvContent("");
    setCsvHeaders([]);
    setOriginalHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setResult(null);
    setError(null);
  }

  const fields = getFields(schema);
  const mappedFields = new Set(
    Object.values(mapping).filter((v) => v !== SKIP && v !== "")
  );
  const requiredFields = fields.filter((f) => f.required).map((f) => f.key);
  const missingRequired = requiredFields.filter((k) => !mappedFields.has(k));

  // ── Step: Upload ──────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload a CSV to map</h2>
        <p className="mt-1 text-sm text-slate-500">
          Drop any installer CSV — we&apos;ll detect the columns and let you
          assign each one to the correct field.
        </p>

        {/* Schema selector */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-slate-700">
            What are you importing?
          </p>
          <div className="flex gap-3">
            {SCHEMAS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSchema(s.value)}
                className={`flex-1 rounded-xl border-2 p-3 text-left transition ${
                  schema === s.value
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <CsvDropZone
            name="file"
            resetKey={fileKey}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>
    );
  }

  // ── Step: Done ────────────────────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import complete</h2>
            <p className="mt-1 text-sm text-slate-600">
              {result.inserted} new rows added, {result.updated} updated
              {result.errors > 0 && `, ${result.errors} rows had errors`}.
            </p>
            {result.errorMessages.length > 0 && (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {result.errorMessages.join("\n")}
              </pre>
            )}
          </div>
        </div>
        <button
          onClick={reset}
          className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Import another file
        </button>
      </div>
    );
  }

  // ── Step: Map ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* File + schema info bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <span className="text-sm font-medium text-slate-800">{fileName}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {schema === "remittance" ? "Remittance" : "Projects"}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            {csvHeaders.length} columns detected
          </span>
        </div>
        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-700">
          ← Change file
        </button>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Column mapping</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            We auto-matched your CSV columns to{" "}
            {schema === "remittance" ? "remittance" : "project"} fields. Correct
            any wrong ones, then click Import.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="w-1/3 px-5 py-2.5">CSV column</th>
                <th className="w-1/3 px-5 py-2.5">Maps to field</th>
                <th className="px-5 py-2.5 text-slate-400">Preview (first rows)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {csvHeaders.map((header, idx) => {
                const originalHeader = originalHeaders[idx] ?? header;
                const selected = mapping[header] ?? SKIP;
                const isSkipped = selected === SKIP;
                return (
                  <tr key={`${idx}-${header}`} className={isSkipped ? "opacity-40" : ""}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">
                      {header}
                    </td>
                    <td className="px-5 py-2.5">
                      <select
                        value={selected}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value={SKIP}>— Skip —</option>
                        {fields.map((f) => (
                          <option
                            key={f.key}
                            value={f.key}
                            disabled={mappedFields.has(f.key) && selected !== f.key}
                          >
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-400">
                      {previewRows
                        .map((r) => r[originalHeader] ?? "")
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(" · ") || <span className="italic">empty</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <div className="text-xs text-slate-500">
            {Object.values(mapping).filter((v) => v !== SKIP).length} of{" "}
            {csvHeaders.length} columns mapped
            {missingRequired.length > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                ⚠ Required:{" "}
                {missingRequired
                  .map((k) => fields.find((f) => f.key === k)?.label ?? k)
                  .join(", ")}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={pending || missingRequired.length > 0}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {pending ? "Importing…" : "Import with this mapping"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <pre className="whitespace-pre-wrap rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </pre>
      )}
    </div>
  );
}
