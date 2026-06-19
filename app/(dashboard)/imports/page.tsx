"use client";

import Link from "next/link";
import { useState } from "react";
import ImportUploadForm from "./ImportUploadForm";
import MappingForm from "../samples/MappingForm";

type Tab = "quick" | "mapper";

export default function ImportsPage() {
  const [tab, setTab] = useState<Tab>("quick");

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import data</h1>
          <p className="text-sm text-slate-500">
            Upload project sheets, remittance files, or any custom CSV.
          </p>
        </div>
        <Link
          href="/imports/history"
          className="text-sm font-medium text-cyan-700 hover:underline"
        >
          View history →
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <TabBtn active={tab === "quick"} onClick={() => setTab("quick")}>
          Quick Import
        </TabBtn>
        <TabBtn active={tab === "mapper"} onClick={() => setTab("mapper")}>
          Field Mapper
        </TabBtn>
      </div>

      {tab === "quick" && (
        <div className="max-w-2xl">
          <p className="mb-4 text-sm text-slate-500">
            Source type is auto-detected from the file name and columns.
            Use this for standard <strong>project sheets</strong> and{" "}
            <strong>remittance files</strong>.
          </p>
          <ImportUploadForm />
        </div>
      )}

      {tab === "mapper" && (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            For non-standard CSVs (e.g. Axia installer files). Map each column
            to the correct field before importing.
          </p>
          <MappingForm />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
