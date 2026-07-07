"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCode, verifyCode } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestCode(email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNotice(`We sent a 6-digit code to ${email.trim().toLowerCase()}.`);
      setStep("code");
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyCode(email, code);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600 text-xl font-bold text-white">
            N
          </div>
          <h1 className="text-xl font-bold text-slate-900">NOX Data Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "email" ? "Sign in with your work email" : "Enter your code"}
          </p>
        </div>

        {notice && step === "code" && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@noxpwr.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {pending ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="w-full text-xs text-slate-400 hover:text-slate-600"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
