import MappingForm from "./MappingForm";
import { listInstallerNames, listMappingTemplates } from "@/lib/data-hub/mapping-templates";

export default async function FieldMapperPage() {
  const [installers, templates] = await Promise.all([
    listInstallerNames(),
    listMappingTemplates(),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Field Mapper</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload any installer CSV — map its columns to the correct project fields,
        then import. Save mappings as templates to reuse on future imports.
      </p>

      <MappingForm installers={installers} initialTemplates={templates} />
    </div>
  );
}
