import { notFound } from "next/navigation";
import { getProject } from "@/lib/data-hub/queries";
import { createServerSupabase } from "@/lib/supabase/server";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const display = value == null || value === "" ? "—" : String(value);
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{display}</dd>
    </div>
  );
}

function MoneyField({ label, value }: { label: string; value: unknown }) {
  const n = value == null ? null : Number(value);
  const display =
    n == null || isNaN(n)
      ? "—"
      : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{display}</dd>
    </div>
  );
}

export async function ProjectDetailContent({ id }: { id: string }) {
  const project = await getProject(id);
  if (!project) notFound();

  const db = createServerSupabase();
  const { data: remittanceRows, error: remittanceErr } = await db
    .from("remittance")
    .select("payment_date, payment_this_week, total_sp_paid, status")
    .eq("project_id", id)
    .order("payment_date", { ascending: false })
    .limit(10);

  const remittance =
    remittanceErr?.message.includes("remittance") ? [] : (remittanceRows ?? []);

  const p = project as Record<string, unknown>;

  return (
    <>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        {(p.opportunity_name as string) ?? (p.project_id as string)}
      </h1>
      <p className="font-mono text-sm text-slate-500">{String(p.project_id)}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Section title="Contact">
          <Field label="Email" value={p.email} />
          <Field label="Phone" value={p.phone} />
          <Field
            label="Address"
            value={[p.address_line1, p.city, p.state_code, p.postal_code]
              .filter(Boolean)
              .join(", ")}
          />
        </Section>
        <Section title="Status">
          <Field label="Project stage" value={p.project_stage} />
          <Field label="Contract signed" value={p.contract_signed_date} />
        </Section>
        <Section title="Sales">
          <Field label="Sales advisor" value={p.sales_advisor_name} />
          <Field label="Advisor email" value={p.sales_advisor_email} />
          <Field label="Setter" value={p.setter_name} />
          <Field label="Setter email" value={p.setter_email} />
          <Field label="Closer" value={p.closer_name} />
          <Field label="Closer email" value={p.closer_email} />
        </Section>
        <Section title="System">
          <Field
            label="System size"
            value={p.system_size_kw != null ? `${p.system_size_kw} kW` : null}
          />
          <MoneyField label="Total cost" value={p.total_system_cost} />
        </Section>
        <Section title="External IDs">
          <Field label="Terros account" value={p.terros_account_id} />
          <Field label="Sequifi sale" value={p.sequifi_sale_id} />
        </Section>
        <Section title="Org">
          <Field label="Market" value={p.market} />
          <Field label="Team" value={p.team} />
          <Field label="Dealer" value={p.dealer_name} />
          <Field label="Office" value={p.office_name} />
        </Section>
      </div>

      {remittance.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">This week</th>
                  <th className="px-4 py-2">Total paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {remittance.map((r) => (
                  <tr key={String(r.payment_date)}>
                    <td className="px-4 py-2">{String(r.payment_date)}</td>
                    <td className="px-4 py-2">{String(r.status ?? "—")}</td>
                    <td className="px-4 py-2">
                      {String(r.payment_this_week ?? "—")}
                    </td>
                    <td className="px-4 py-2">{String(r.total_sp_paid ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
