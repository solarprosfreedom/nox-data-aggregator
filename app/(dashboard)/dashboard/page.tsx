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
    <section className={`overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className}`}>
      {(title || eyebrow) && (
        <div className="border-b border-slate-100 px-5 py-4">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {eyebrow}
            </p>
          )}
          {title && <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">{title}</h2>}
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
    <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-3xl font-semibold tracking-tight text-slate-950">
                {fmt(item.value)}
              </p>
              <p className="max-w-36 text-right text-xs font-medium leading-5 text-slate-500">
                {item.detail}
              </p>
            </div>
            <div className="mt-4 h-1 rounded-full bg-slate-100">
              <div
                className="h-1 rounded-full bg-orange-500"
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
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.vendor}
            className="grid gap-4 px-5 py-4 transition-colors hover:bg-orange-50/30 md:grid-cols-[minmax(180px,1fr)_auto_auto]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(248,90,50,0.10)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{row.label}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Updated {fmtDate(row.latestUpdated)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-6 md:block md:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Projects
              </p>
              <p className="mt-1 tabular-nums text-lg font-semibold tracking-tight text-slate-950">
                {fmt(row.count)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-6 md:block md:min-w-28 md:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Remittance
              </p>
              <p className="mt-1 tabular-nums text-lg font-semibold tracking-tight text-slate-600">
                {fmt(row.withRemittance)}
              </p>
            </div>
          </div>
        ))}
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        <InstallerTable rows={stats.installerStats} />
        <StageDistribution rows={stats.stageStats} total={stats.totalProjects} />
      </div>
    </div>
  );
}
