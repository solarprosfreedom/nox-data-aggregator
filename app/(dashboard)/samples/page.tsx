import MappingForm from "./MappingForm";

export default function FieldMapperPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Field Mapper</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload any installer CSV — map its columns to the correct project fields,
        then import. Your mapping choices are shown as suggestions each time.
      </p>

      <MappingForm />
    </div>
  );
}
