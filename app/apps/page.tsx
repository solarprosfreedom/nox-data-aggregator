import Link from "next/link";
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
  ].filter((c) => c.enabled);

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
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.color} text-white font-bold`}
                >
                  N
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </Link>
            ) : (
              <a
                key={card.slug}
                href={card.href}
                className="rounded-2xl bg-white p-6 shadow-xl transition hover:scale-[1.02]"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.color} text-white font-bold`}
                >
                  N
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
