"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import {
  IconApps,
  IconDashboard,
  IconHistory,
  IconImport,
  IconLogOut,
  IconProjects,
  IconUsers,
} from "@/components/ui/icons";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
};

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <IconDashboard size={17} />, exact: true },
  { href: "/projects", label: "Projects", icon: <IconProjects size={17} /> },
  { href: "/imports", label: "Import", icon: <IconImport size={17} />, exact: true },
  { href: "/imports/history", label: "History", icon: <IconHistory size={17} /> },
];

const MEMBER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <IconDashboard size={17} />, exact: true },
  { href: "/projects", label: "Projects", icon: <IconProjects size={17} />, exact: true },
];

function NavLinkInner({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span>{label}</span>
      {pending && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" />
      )}
    </>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      prefetch={true}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-white text-slate-950 shadow-sm ring-1 ring-orange-100"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-orange-500" />
      )}
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
          active
            ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
            : "bg-white text-slate-500 ring-1 ring-slate-200 group-hover:text-orange-700 group-hover:ring-orange-200"
        }`}
      >
        {icon}
      </span>
      <NavLinkInner label={label} />
    </Link>
  );
}

export default function AppShell({
  children,
  email,
  isAdmin = false,
}: {
  children: ReactNode;
  email?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const NAV = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  return (
    <div className="flex min-h-screen bg-[#f6f7fb]">
      <aside className="flex w-64 flex-col border-r border-orange-100 bg-[#fff7f1] shadow-[1px_0_0_rgba(248,90,50,0.04)]">
        <div className="border-b border-orange-100/80 px-4 py-5">
          <div className="rounded-lg border border-orange-100 bg-white px-3 py-2 shadow-sm">
            <Image
              src="/logo.png"
              alt="NOX PWR"
              width={120}
              height={34}
              className="h-[34px] w-auto object-contain"
            />
          </div>
          <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700/70">
            Data Hub
          </p>
        </div>
        <nav className="flex-1 space-y-1.5 p-3">
          <Link
            href="/apps"
            prefetch={true}
            className="mb-3 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/70 hover:text-slate-950"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200">
              <IconApps size={16} />
            </span>
            All apps
          </Link>
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
              />
            );
          })}
          {isAdmin && (
            <NavItem
              href="/admin"
              label="User Access"
              icon={<IconUsers size={17} />}
              active={pathname === "/admin"}
            />
          )}
        </nav>
        <div className="border-t border-orange-100/80 p-3">
          <p className="truncate px-3 text-xs font-medium text-slate-500">{email}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-950"
            >
              <IconLogOut size={16} className="text-slate-400" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">{children}</main>
    </div>
  );
}
