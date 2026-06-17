"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CsvDropZoneProps = {
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Change to clear the selected file (e.g. after form reset). */
  resetKey?: number;
  onFileSelect?: (file: File) => void;
};

function isCsvFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  );
}

export default function CsvDropZone({
  name = "file",
  required = false,
  disabled = false,
  resetKey = 0,
  onFileSelect,
}: CsvDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    setFileName(null);
    setDropError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [resetKey]);

  const assignFile = useCallback(
    (file: File | null) => {
      setDropError(null);
      if (!file) return;

      if (!isCsvFile(file)) {
        setDropError("Only CSV files are supported.");
        return;
      }

      const dt = new DataTransfer();
      dt.items.add(file);
      if (inputRef.current) {
        inputRef.current.files = dt.files;
      }
      setFileName(file.name);
      onFileSelect?.(file);
    },
    [onFileSelect]
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) assignFile(file);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : dragging
              ? "border-cyan-500 bg-cyan-50"
              : fileName
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/40"
        }`}
      >
        <svg
          className={`mb-3 h-10 w-10 ${dragging ? "text-cyan-600" : "text-slate-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        {fileName ? (
          <>
            <p className="text-sm font-medium text-emerald-800">{fileName}</p>
            <p className="mt-1 text-xs text-slate-500">
              Drop another file or click to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              {dragging ? "Drop CSV here" : "Drag & drop a CSV file here"}
            </p>
            <p className="mt-1 text-xs text-slate-500">or click to browse</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          name={name}
          accept=".csv,text/csv"
          required={required && !fileName}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) assignFile(file);
            else setFileName(null);
          }}
        />
      </div>

      {dropError && (
        <p className="mt-2 text-xs text-red-600">{dropError}</p>
      )}
    </div>
  );
}
