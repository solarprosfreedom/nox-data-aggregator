import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { listHubUsers } from "./actions";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/projects");

  const users = await listHubUsers();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">User Access</h1>
      <p className="mb-6 text-sm text-slate-500">
        Manage who can log in to the Data Hub.
      </p>
      <AdminClient users={users} currentUserId={profile.id} />
    </div>
  );
}
