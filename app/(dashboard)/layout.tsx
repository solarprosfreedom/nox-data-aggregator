import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import PageSkeleton from "@/components/ui/PageSkeleton";
import {
  getCurrentProfile,
  getUserAppAccess,
} from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const apps = await getUserAppAccess(profile.id);
  if (!apps.includes("nox-data-hub")) {
    redirect("/apps");
  }

  return (
    <AppShell email={profile.email} isAdmin={profile.role === "admin"}>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </AppShell>
  );
}
