import { notFound } from "next/navigation";
import { getProject } from "@/lib/data-hub/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeGrossPpw, computeNetPpw, formatPpw } from "@/lib/data-hub/ppw";
import { customerDisplayName } from "@/lib/data-hub/normalize";

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

function formatUsPhone(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return raw;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function systemSizeWatts(kw: unknown): string | null {
  if (kw == null) return null;
  const n = Number(kw);
  if (isNaN(n)) return null;
  return `${Math.round(n * 1000).toLocaleString("en-US")} W`;
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
    .select("payment_date, payment_this_week, total_sp_paid, status, customer_name, battery_price, adder_amount")
    .eq("project_id", id)
    .order("imported_at", { ascending: false })
    .limit(10);

  const remittance =
    remittanceErr?.message.includes("remittance") ? [] : (remittanceRows ?? []);

  const p = project as Record<string, unknown>;
  const latestRemitStatus = remittance[0]?.status as string | undefined;
  const latestRemitCustomer = remittance[0]?.customer_name as string | undefined;
  const latestRemit = remittance[0] as
    | { battery_price?: number | null; adder_amount?: number | null }
    | undefined;
  const grossPpw = computeGrossPpw(
    p.total_system_cost as number | null,
    p.system_size_kw as number | null
  );
  const netPpw = computeNetPpw(
    p.total_system_cost as number | null,
    p.system_size_kw as number | null,
    latestRemit?.battery_price,
    latestRemit?.adder_amount
  );
  const displayName =
    customerDisplayName(p.opportunity_name as string) ??
    latestRemitCustomer?.trim() ??
    (p.project_id as string);
  const stage =
    latestRemitStatus?.trim() || (p.project_stage as string | undefined)?.trim() || null;
  const salesRep =
    (p.closer_name as string | undefined)?.trim() ||
    (p.sales_advisor_name as string | undefined)?.trim() ||
    (p.setter_name as string | undefined)?.trim() ||
    null;

  return (
    <>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{displayName}</h1>
      <p className="font-mono text-sm text-slate-500">{String(p.project_id)}</p>
      {!p.terros_account_id && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          No Terros match
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Section title="Contact">
          <Field label="Email" value={p.email} />
          <Field label="Phone" value={formatUsPhone(p.phone)} />
          <Field
            label="Address"
            value={[p.address_line1, p.city, p.state_code, p.postal_code]
              .filter(Boolean)
              .join(", ")}
          />
        </Section>
        <Section title="Status">
          <Field label="Stage" value={stage} />
          <Field label="Contract signed" value={p.contract_signed_date} />
        </Section>
        <Section title="Sales">
          <Field label="Setter" value={p.setter_name} />
          <Field label="Setter email" value={p.setter_email} />
          <Field label="Sales rep" value={salesRep} />
          <Field label="Sales advisor" value={p.sales_advisor_name} />
          <Field label="Advisor email" value={p.sales_advisor_email} />
        </Section>
        <Section title="System">
          <Field label="System size" value={systemSizeWatts(p.system_size_kw)} />
          <MoneyField label="Total cost" value={p.total_system_cost} />
          <Field label="Gross PPW (calc)" value={formatPpw(grossPpw)} />
          <Field label="Net PPW (calc)" value={formatPpw(netPpw)} />
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
