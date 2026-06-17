"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/login/actions";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/remittance", label: "Remittance" },
  { href: "/samples", label: "Samples" },
  { href: "/imports", label: "Import projects" },
  { href: "/imports/history", label: "History" },
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
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-cyan-50 text-cyan-800"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <NavLinkInner label={label} />
    </Link>
  );
}

export default function AppShell({
  children,
  email,
}: {
  children: ReactNode;
  email?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
              N
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Data Hub</p>
              <p className="text-xs text-slate-500">NOX PWR</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/apps"
            prefetch={true}
            className="mb-2 block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            ← All apps
          </Link>
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={active}
              />
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 text-xs text-slate-400">{email}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
