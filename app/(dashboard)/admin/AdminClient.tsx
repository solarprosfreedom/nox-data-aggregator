"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { inviteUser, removeAccess, setRole } from "./actions";

type User = { id: string; email: string; role: "admin" | "member"; fullName: string | null };

export default function AdminClient({
  users: initial,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  function notify(text: string, ok: boolean) {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), 5000);
  }

  function handleRemove(userId: string, userEmail: string) {
    if (!confirm(`Remove access for ${userEmail}?`)) return;
    startTransition(async () => {
      const res = await removeAccess(userId);
      if ("error" in res) notify(res.error, false);
      else {
        setUsers((u) => u.filter((x) => x.id !== userId));
        notify(`Removed ${userEmail}.`, true);
      }
    });
  }

  function handleRoleToggle(user: User) {
    const next = user.role === "admin" ? "member" : "admin";
    if (!confirm(`Change ${user.email} to ${next}?`)) return;
    startTransition(async () => {
      const res = await setRole(user.id, next);
      if ("error" in res) notify(res.error, false);
      else {
        setUsers((u) => u.map((x) => x.id === user.id ? { ...x, role: next } : x));
        notify(`${user.email} is now ${next}.`, true);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {users.length} user{users.length !== 1 ? "s" : ""} with access
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add user
        </button>
      </div>

      {notice && (
        <p className={`rounded-lg px-4 py-2.5 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {notice.text}
        </p>
      )}

      {/* User list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {users.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No users yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id ?? u.email} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{u.email}</p>
                  {u.fullName && <p className="text-xs text-slate-400">{u.fullName}</p>}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => u.id !== currentUserId && handleRoleToggle(u)}
                    disabled={pending || u.id === currentUserId}
                    title={u.id === currentUserId ? "Your own role" : `Click to switch to ${u.role === "admin" ? "member" : "admin"}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      u.role === "admin"
                        ? "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    } ${u.id === currentUserId ? "cursor-default opacity-60" : "cursor-pointer"}`}
                  >
                    {u.role}
                  </button>
                  {u.id !== currentUserId ? (
                    <button
                      onClick={() => handleRemove(u.id, u.email)}
                      disabled={pending}
                      title="Remove access"
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0h10" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">you</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <AddUserModal
          onClose={() => setShowModal(false)}
          onAdded={(u) => {
            setUsers((prev) => [...prev, u]);
            setShowModal(false);
            notify(`${u.email} added successfully.`, true);
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (user: User) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteUser({ email, full_name: fullName, role });
      if ("error" in res) {
        setError(res.error);
      } else {
        onAdded({ id: "", email: email.trim().toLowerCase(), role, fullName: fullName.trim() || null });
      }
    });
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add user</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@noxpwr.com"
              required
              autoFocus
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
            <div className="flex gap-2">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    role === r
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {role === "admin" ? "Can manage users and all data." : "Can view and import data, no user management."}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="flex-1 rounded-lg bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add user"}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}
