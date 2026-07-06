import SyncButton from "./SyncButton";
import SequifiSyncButton from "./SequifiSyncButton";
import SyncFilters from "./SyncFilters";
import PageHeader from "@/components/ui/PageHeader";
import { IconDatabase, IconSync } from "@/components/ui/icons";

export default function SyncPage() {
  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader icon={<IconDatabase size={20} />} title="Sync" />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <IconSync size={16} />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Sync setters</h2>
        </div>
        <SyncButton />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
            <IconDatabase size={16} />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Sequifi</h2>
        </div>
        <SequifiSyncButton />
      </section>

      <SyncFilters />
    </div>
  );
}
