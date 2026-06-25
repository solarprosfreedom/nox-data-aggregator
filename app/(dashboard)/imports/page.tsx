import Link from "next/link";
import ImportUploadForm from "./ImportUploadForm";
import MappingForm from "../samples/MappingForm";
import ImportsTabs from "./ImportsTabs";
import { listInstallerNames, listMappingTemplates } from "@/lib/data-hub/mapping-templates";

export default async function ImportsPage() {
  const [installers, templates] = await Promise.all([
    listInstallerNames(),
    listMappingTemplates(),
  ]);

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

      <ImportsTabs
        quickImport={
          <div className="max-w-2xl">
            <p className="mb-4 text-sm text-slate-500">
              Source type is auto-detected from the file name and columns.
              Use this for standard <strong>projects sheets</strong> and{" "}
              <strong>remittance files</strong>.
            </p>
            <ImportUploadForm installers={installers} />
          </div>
        }
        fieldMapper={
          <div>
            <p className="mb-4 text-sm text-slate-500">
              For non-standard CSVs (e.g. Axia installer files). Map each column to
              project or remittance fields in one step — existing projects are updated
              with whatever columns are in the file.
            </p>
            <MappingForm installers={installers} initialTemplates={templates} />
          </div>
        }
      />
    </div>
  );
}
