import PageHeader from "@/components/ui/PageHeader";
import { IconDashboard } from "@/components/ui/icons";
import {
  getDashboardStats,
  type InstallerDashboardStat,
} from "@/lib/data-hub/dashboard-stats";
import StageDistribution from "./StageDistribution";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fmt(value: number) {
  return numberFormatter.format(value);
}

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function fmtDate(value: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "None";
  return dateFormatter.format(date);
}

function Card({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || eyebrow) && (
        <div className="border-b border-slate-100 px-5 py-4">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              {eyebrow}
            </p>
          )}
          {title && <h2 className="mt-0.5 text-sm font-semibold text-slate-950">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

function OverviewStrip({
  totalProjects,
  withRemittance,
}: {
  totalProjects: number;
  withRemittance: number;
}) {
  const withoutRemittance = totalProjects - withRemittance;
  const items = [
    {
      label: "Total projects",
      value: totalProjects,
      detail: "Across all installer endpoints",
      width: "100%",
    },
    {
      label: "With remittance",
      value: withRemittance,
      detail: `${pct(withRemittance, totalProjects)} of projects`,
      width: pct(withRemittance, totalProjects),
    },
    {
      label: "Without remittance",
      value: withoutRemittance,
      detail: `${pct(withoutRemittance, totalProjects)} missing payment data`,
      width: pct(withoutRemittance, totalProjects),
    },
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-3xl font-semibold tracking-tight text-slate-950">
                {fmt(item.value)}
              </p>
              <p className="text-right text-xs font-medium text-slate-400">
                {item.detail}
              </p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-orange-500"
                style={{ width: item.width }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstallerTable({
  rows,
}: {
  rows: InstallerDashboardStat[];
}) {
  return (
    <Card title="Installer Counts" eyebrow="Source tables">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Installer</th>
              <th className="px-5 py-3 text-right">Projects</th>
              <th className="px-5 py-3 text-right">Remittance</th>
              <th className="px-5 py-3 text-right">Latest update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.vendor} className="transition-colors hover:bg-orange-50/40">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    <span className="font-semibold text-slate-950">{row.label}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums font-medium text-slate-950">
                  {fmt(row.count)}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-slate-500">
                  {fmt(row.withRemittance)}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-500">
                  {fmtDate(row.latestUpdated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconDashboard size={20} />}
        title="Dashboard"
        description="Endpoint-backed project and remittance stats."
      />

      <OverviewStrip
        totalProjects={stats.totalProjects}
        withRemittance={stats.withRemittance}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        <InstallerTable rows={stats.installerStats} />
        <StageDistribution rows={stats.stageStats} total={stats.totalProjects} />
      </div>
    </div>
  );
}
