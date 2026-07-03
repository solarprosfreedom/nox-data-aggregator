"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import {
  IconApps,
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
  { href: "/projects", label: "Projects", icon: <IconProjects size={17} /> },
  { href: "/imports", label: "Import", icon: <IconImport size={17} />, exact: true },
  { href: "/imports/history", label: "History", icon: <IconHistory size={17} /> },
];

const MEMBER_NAV: NavItem[] = [
  { href: "/projects", label: "Projects", icon: <IconProjects size={17} />, exact: true },
];

function NavLinkInner({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span>{label}</span>
      {pending && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600" />
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
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-cyan-50 text-cyan-900 ring-1 ring-cyan-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
          active
            ? "bg-cyan-100 text-cyan-700"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
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
    <div className="flex min-h-screen bg-slate-50/80">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-5">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="NOX PWR"
              width={120}
              height={34}
              className="h-[34px] w-auto object-contain"
            />
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            Data Hub
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/apps"
            prefetch={true}
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
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
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 text-xs text-slate-400">{email}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <IconLogOut size={16} className="text-slate-400" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
