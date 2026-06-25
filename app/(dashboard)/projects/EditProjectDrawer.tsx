"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { updateProject } from "./actions";
import type { ProjectWithRemittance } from "@/lib/data-hub/queries";
import {
  initProjectForm,
  PROJECT_EDIT_FIELDS,
  REMITTANCE_EDIT_FIELDS,
  type ProjectFormData,
} from "@/lib/data-hub/project-edit-form";

function FieldInput({
  fieldKey,
  label,
  type = "text",
  value,
  inputRef,
  onChange,
}: {
  fieldKey: string;
  label: string;
  type?: "text" | "date" | "number";
  value: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-slate-500">{label}</label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
    </div>
  );
}

export default function EditProjectDrawer({ project }: { project: ProjectWithRemittance }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormData>(() => initProjectForm(project, project.remittance));
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(initProjectForm(project, project.remittance));
  }, [project.id, project.remittance?.id, project.updated_at]);

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleChange(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProject(project.id, form);
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
        }, 700);
      }
    });
  }

  const hasRemittance = project.remittance != null;

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccess(false);
        }}
        className="rounded p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"
        title="Edit project"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 3.487a2.25 2.25 0 013.182 3.182L7.5 19.213l-4.5 1.125 1.125-4.5L16.862 3.487z"
          />
        </svg>
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998] bg-black/30" onClick={() => setOpen(false)} />

            <div className="fixed inset-y-0 right-0 z-[9999] flex w-full max-w-lg flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Edit project</p>
                  <p className="font-mono text-sm font-semibold text-slate-800">{project.project_id}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Project</h3>
                    <div className="space-y-3">
                      {PROJECT_EDIT_FIELDS.map(({ key, label, type = "text" }, i) => (
                        <FieldInput
                          key={key}
                          fieldKey={key}
                          label={label}
                          type={type}
                          value={form[key] ?? ""}
                          inputRef={i === 0 ? firstRef : undefined}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">Remittance (latest)</h3>
                    <p className="mb-3 text-xs text-slate-500">
                      {hasRemittance
                        ? "Updates the latest remittance row linked to this project."
                        : "No remittance row yet. Fill fields below to create one."}
                    </p>
                    <div className="space-y-3">
                      {REMITTANCE_EDIT_FIELDS.map(({ key, label, type = "text" }) => (
                        <FieldInput
                          key={key}
                          fieldKey={key}
                          label={label}
                          type={type}
                          value={form[key] ?? ""}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-4">
                {error && (
                  <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
                )}
                {success && (
                  <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Saved.</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={pending}
                    className="flex-1 rounded-lg bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
