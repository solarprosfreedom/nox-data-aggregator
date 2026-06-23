import SyncButton from "./SyncButton";
import SequifiSyncButton from "./SequifiSyncButton";
import SyncFilters from "./SyncFilters";

export default function SyncPage() {
  return (
    <div className="max-w-4xl">
      <section>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Sync Setters</h1>
        <p className="mb-6 text-sm text-slate-500">
          Match projects to the synced Terros accounts by email, phone, or address
          to fill in setter and closer names.
        </p>
        <SyncButton />
      </section>

      <section>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Sequifi</h1>
        <p className="mb-6 text-sm text-slate-500">
          Two-way reconcile between the hub and Sequifi sales.
        </p>
        <SequifiSyncButton />
      </section>

      <div className="my-12 border-t border-slate-200" aria-hidden />

      <SyncFilters />
    </div>
  );
}
