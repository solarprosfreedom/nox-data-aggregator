import Link from "next/link";
import ImportUploadForm from "./ImportUploadForm";
import MappingForm from "../samples/MappingForm";
import ImportsTabs from "./ImportsTabs";
import PageHeader from "@/components/ui/PageHeader";
import { IconHistory, IconImport } from "@/components/ui/icons";
import { listInstallerNames } from "@/lib/data-hub/mapping-templates";

export default async function ImportsPage() {
  const installers = await listInstallerNames();

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={<IconImport size={20} />}
        title="Import data"
        actions={
          <Link
            href="/imports/history"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <IconHistory size={16} className="text-slate-500" />
            View history
          </Link>
        }
      />

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
            <MappingForm installers={installers} initialTemplates={[]} />
          </div>
        }
      />
    </div>
  );
}
