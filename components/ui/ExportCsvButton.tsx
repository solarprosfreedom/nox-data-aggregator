"use client";

import { useState } from "react";
import { IconDownload } from "@/components/ui/icons";

export default function ExportCsvButton({
  href,
  label = "Export CSV",
}: {
  href: string;
  label?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? "projects.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("CSV export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isExporting}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition ${
        isExporting ? "cursor-not-allowed opacity-70" : "hover:bg-slate-50"
      }`}
    >
      {isExporting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Exporting...
        </>
      ) : (
        <>
          <IconDownload size={16} className="text-slate-500" />
          {label}
        </>
      )}
    </button>
  );
}
