"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import CsvDropZone from "@/components/ui/CsvDropZone";
import InstallerSelect from "@/components/ui/InstallerSelect";
import {
  getFields,
  getRequiredFieldKeys,
  isFieldMappingBlocked,
  normalizeTemplateColumnMap,
  SKIP,
  autoSuggestMapping,
} from "@/lib/data-hub/field-mapper";
import { parseCsv, rowsToRecords, findHeaderRowIndex } from "@/lib/csv/parse";
import type { MappingTemplate } from "@/lib/data-hub/mapping-templates";
import {
  deleteMappingTemplate,
  fetchMappingTemplates,
  importWithMapping,
  saveMappingTemplate,
} from "./actions";

type Step = "upload" | "map" | "done";

type ImportResult = {
  inserted: number;
  updated: number;
  remittanceInserted: number;
  remittanceUpdated: number;
  errors: number;
  errorMessages: string[];
};

function applyTemplateToHeaders(
  csvHeaders: string[],
  originalHeaders: string[],
  templateMap: Record<string, string>,
): Record<string, string> {
  const normalizedMap = normalizeTemplateColumnMap(templateMap);
  const base = autoSuggestMapping(csvHeaders, "projects");
  const usedFields = new Set<string>();

  for (let idx = 0; idx < csvHeaders.length; idx++) {
    const deduped = csvHeaders[idx]!;
    const original = originalHeaders[idx] ?? deduped;
    const fieldKey = normalizedMap[original] ?? normalizedMap[deduped];
    if (fieldKey && fieldKey !== SKIP && !usedFields.has(fieldKey)) {
      base[deduped] = fieldKey;
      usedFields.add(fieldKey);
    }
  }

  return base;
}

export default function MappingForm({
  installers,
  initialTemplates,
}: {
  installers: string[];
  initialTemplates: MappingTemplate[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileKey, setFileKey] = useState(0);
  const [installer, setInstaller] = useState("");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<MappingTemplate[]>(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const schemaTemplates = useMemo(
    () => templates.filter((t) => t.schema_type === "projects" || t.schema_type === "remittance"),
    [templates],
  );

  useEffect(() => {
    startTransition(async () => {
      const res = await fetchMappingTemplates(undefined, installer || undefined);
      if (Array.isArray(res)) {
        setTemplates(
          res.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ),
        );
      }
    });
  }, [installer]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const text = await file.text();
      const rows = parseCsv(text);
      const records = rowsToRecords(rows);

      const headerIdx = findHeaderRowIndex(rows);
      const rawHeaders = rows[headerIdx]?.map((h) => h.trim().replace(/\s+/g, " ")) ?? [];

      const deduped = rawHeaders.map((h, i) => {
        const count = rawHeaders.slice(0, i).filter((x) => x === h).length;
        return count > 0 ? `${h} (${count + 1})` : h;
      });

      setCsvContent(text);
      setFileName(file.name);
      setOriginalHeaders(rawHeaders);
      setCsvHeaders(deduped);
      setPreviewRows(records.slice(0, 3));

      const template = schemaTemplates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setMapping(applyTemplateToHeaders(deduped, rawHeaders, template.column_map));
      } else {
        setMapping(autoSuggestMapping(deduped, "projects"));
      }

      setStep("map");
      setResult(null);
      setError(null);
      setSaveMessage(null);
    },
    [schemaTemplates, selectedTemplateId],
  );

  function loadTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId || csvHeaders.length === 0) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setMapping(applyTemplateToHeaders(csvHeaders, originalHeaders, template.column_map));
    if (template.installer_name) setInstaller(template.installer_name);
    setTemplateName(template.name);
  }

  function handleMappingChange(csvCol: string, fieldKey: string) {
    setMapping((prev) => ({ ...prev, [csvCol]: fieldKey }));
  }

  function resolvedColumnMap(): Record<string, string> {
    const resolvedMapping: Record<string, string> = {};
    csvHeaders.forEach((deduped, idx) => {
      const original = originalHeaders[idx] ?? deduped;
      const fieldKey = mapping[deduped] ?? SKIP;
      if (fieldKey !== SKIP) resolvedMapping[original] = fieldKey;
    });
    return resolvedMapping;
  }

  function handleImport() {
    setError(null);
    const fd = new FormData();
    fd.set("content", csvContent);
    fd.set("fileName", fileName);
    fd.set("schema", "projects");
    fd.set("installer", installer);
    fd.set("mapping", JSON.stringify(resolvedColumnMap()));

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

  function handleSaveTemplate() {
    setSaveMessage(null);
    const fd = new FormData();
    fd.set("name", templateName.trim() || `${installer || "Generic"} mapping`);
    fd.set("schema_type", "projects");
    fd.set("installer_name", installer);
    fd.set("column_map", JSON.stringify(resolvedColumnMap()));
    if (selectedTemplateId) fd.set("id", selectedTemplateId);

    startTransition(async () => {
      const res = await saveMappingTemplate(fd);
      if ("error" in res) {
        setSaveMessage(res.error);
        return;
      }
      setSelectedTemplateId(res.id);
      setSaveMessage("Template saved.");
      const refreshed = await fetchMappingTemplates(undefined, installer || undefined);
      if (Array.isArray(refreshed)) {
        setTemplates(
          refreshed.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ),
        );
      }
    });
  }

  function handleDeleteTemplate() {
    if (!selectedTemplateId) return;
    startTransition(async () => {
      const res = await deleteMappingTemplate(selectedTemplateId);
      if ("error" in res) {
        setSaveMessage(res.error);
        return;
      }
      setSelectedTemplateId("");
      setTemplateName("");
      setSaveMessage("Template deleted.");
      setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplateId));
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
    setSaveMessage(null);
  }

  const fields = getFields("projects");
  const mappedFields = new Set(
    Object.values(mapping).filter((v) => v !== SKIP && v !== ""),
  );
  const requiredFields = getRequiredFieldKeys("projects");
  const missingRequired = requiredFields.filter((k) => !mappedFields.has(k));

  if (step === "upload") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload a CSV to map</h2>
        <p className="mt-1 text-sm text-slate-500">
          Map columns to project and remittance fields in one pass. Existing projects
          are updated with whatever columns are in your file.
        </p>

        <div className="mt-5">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Installer
          </label>
          <InstallerSelect
            options={installers}
            value={installer}
            onChange={setInstaller}
            placeholder="Apply to all rows (optional)…"
          />
        </div>

        {schemaTemplates.length > 0 && (
          <div className="mt-5">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Load saved mapping (optional)
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => loadTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Auto-detect columns</option>
              {schemaTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.installer_name ? ` (${t.installer_name})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

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
              {result.inserted} projects created, {result.updated} projects updated.
              {result.remittanceInserted + result.remittanceUpdated > 0 && (
                <>
                  {" "}
                  Remittance: {result.remittanceInserted} new, {result.remittanceUpdated}{" "}
                  updated.
                </>
              )}
              {result.errors > 0 && ` ${result.errors} rows had errors.`}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <span className="text-sm font-medium text-slate-800">{fileName}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Projects + Remittance
          </span>
          <span className="ml-2 text-xs text-slate-400">
            {csvHeaders.length} columns detected
          </span>
        </div>
        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-700">
          ← Change file
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Installer for this batch
        </label>
        <InstallerSelect
          options={installers}
          value={installer}
          onChange={setInstaller}
          placeholder="Apply to all rows (optional)…"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Column mapping</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Map CSV columns to project or remittance fields. Only mapped columns are
            written. Existing projects get partial updates; remittance updates the latest
            row for that project.
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
                            disabled={isFieldMappingBlocked(
                              f.key,
                              mappedFields,
                              selected,
                            )}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <div className="text-xs text-slate-500">
            {Object.values(mapping).filter((v) => v !== SKIP).length} of{" "}
            {csvHeaders.length} columns mapped
            {missingRequired.length > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                Required:{" "}
                {missingRequired
                  .map((k) => fields.find((f) => f.key === k)?.label ?? k)
                  .join(", ")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Save mapping template</h3>
        <p className="mt-1 text-xs text-slate-500">
          Reuse this column mapping on future imports for the same installer.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-slate-500">Template name</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Axia combined v1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            value={selectedTemplateId}
            onChange={(e) => loadTemplate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">New template</option>
            {schemaTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={pending}
            className="rounded-lg border border-cyan-600 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-60"
          >
            Save template
          </button>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={handleDeleteTemplate}
              disabled={pending}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
        {saveMessage && (
          <p
            className={`mt-2 text-xs ${
              saveMessage.includes("failed") ||
              saveMessage.includes("error") ||
              saveMessage.includes("required")
                ? "text-red-600"
                : "text-emerald-600"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </div>

      {error && (
        <pre className="whitespace-pre-wrap rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </pre>
      )}
    </div>
  );
}
