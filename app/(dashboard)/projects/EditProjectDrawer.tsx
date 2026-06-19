"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { updateProject, type ProjectFormData } from "./actions";
import type { ProjectWithRemittance } from "@/lib/data-hub/queries";

type Field = { key: keyof ProjectFormData; label: string; type?: "text" | "date" | "number" };

const FIELDS: Field[] = [
  // Identity
  { key: "opportunity_name",    label: "Customer Name" },
  { key: "first_name",          label: "First Name" },
  { key: "last_name",           label: "Last Name" },
  // Contact
  { key: "email",               label: "Email" },
  { key: "phone",               label: "Phone" },
  // Address
  { key: "address_line1",       label: "Street Address" },
  { key: "city",                label: "City" },
  { key: "state_code",          label: "State" },
  { key: "postal_code",         label: "Zip Code" },
  // Deal
  { key: "project_stage",       label: "Project Stage" },
  { key: "contract_signed_date",label: "Contract Date",   type: "date" },
  { key: "system_size_kw",      label: "System Size (kW)", type: "number" },
  { key: "total_system_cost",   label: "Total Cost ($)",   type: "number" },
  { key: "installer",           label: "Installer" },
  // People
  { key: "sales_advisor_name",  label: "Sales Advisor" },
  { key: "sales_advisor_email", label: "Sales Advisor Email" },
  { key: "setter_name",         label: "Setter Name" },
  { key: "setter_email",        label: "Setter Email" },
  { key: "closer_name",         label: "Closer Name" },
  { key: "closer_email",        label: "Closer Email" },
  // Org
  { key: "market",              label: "Market" },
  { key: "team",                label: "Team" },
  { key: "region",              label: "Region" },
  { key: "division",            label: "Division" },
  { key: "dealer_name",         label: "Dealer" },
  { key: "office_name",         label: "Office" },
];

function toFormValue(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function initForm(p: ProjectWithRemittance): ProjectFormData {
  const r = p as Record<string, unknown>;
  return Object.fromEntries(FIELDS.map(({ key }) => [key, toFormValue(r[key])])) as ProjectFormData;
}

export default function EditProjectDrawer({ project }: { project: ProjectWithRemittance }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormData>(() => initForm(project));
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  // Reset form when project changes (after a successful save the parent re-renders)
  useEffect(() => { setForm(initForm(project)); }, [project.id]);

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 50);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleChange(key: keyof ProjectFormData, val: string) {
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
        setTimeout(() => { setOpen(false); setSuccess(false); }, 700);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); setSuccess(false); }}
        className="rounded p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"
        title="Edit project"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 013.182 3.182L7.5 19.213l-4.5 1.125 1.125-4.5L16.862 3.487z" />
        </svg>
      </button>

      {open && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/30"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-[9999] flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {FIELDS.map(({ key, label, type = "text" }, i) => (
              <div key={key}>
                <label className="mb-0.5 block text-xs font-medium text-slate-500">{label}</label>
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type={type}
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
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
        document.body
      )}
    </>
  );
}
