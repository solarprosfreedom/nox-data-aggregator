import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  getCurrentProfile,
  getUserAppAccess,
  getAppUrls,
} from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const apps = await getUserAppAccess(profile.id);
  const urls = getAppUrls();

  const cards = [
    {
      slug: "nox-crm" as const,
      title: "NOX CRM",
      description: "Deals, customers, installs, and pipeline workflow.",
      href: urls.crm,
      enabled: apps.includes("nox-crm"),
      color: "bg-orange-600",
      underDevelopment: true,
    },
    {
      slug: "nox-data-hub" as const,
      title: "Data Hub",
      description: "Import projects, Terros exports, and remittance files.",
      href: "/projects",
      enabled: apps.includes("nox-data-hub"),
      color: "bg-cyan-600",
      internal: true,
    },
  // Always show under-development cards even without explicit access.
  ].filter((c) => c.enabled || ("underDevelopment" in c && c.underDevelopment));

  if (cards.length === 1 && cards[0]?.internal) {
    redirect("/projects");
  }
  if (cards.length === 1 && !cards[0]?.internal) {
    redirect(cards[0]!.href);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center text-white">
          <h1 className="text-2xl font-bold">Choose an app</h1>
          <p className="mt-2 text-slate-400">
            Signed in as {profile.email}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) =>
            card.internal ? (
              <Link
                key={card.slug}
                href={card.href}
                className="rounded-2xl bg-white p-6 shadow-xl transition hover:scale-[1.02]"
              >
                <div className="mb-4">
                  <Image src="/logo.png" alt="NOX PWR" width={160} height={46} className="h-[46px] w-auto object-contain" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </Link>
            ) : "underDevelopment" in card && card.underDevelopment ? (
              <div
                key={card.slug}
                className="relative rounded-2xl bg-white p-6 shadow-xl opacity-60 cursor-not-allowed"
              >
                <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Under Development
                </span>
                <div className="mb-4">
                  <Image src="/logo.png" alt="NOX PWR" width={160} height={46} className="h-[46px] w-auto object-contain" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </div>
            ) : (
              <a
                key={card.slug}
                href={card.href}
                className="rounded-2xl bg-white p-6 shadow-xl transition hover:scale-[1.02]"
              >
                <div className="mb-4">
                  <Image src="/logo.png" alt="NOX PWR" width={160} height={46} className="h-[46px] w-auto object-contain" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}
