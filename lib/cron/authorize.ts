import { NextRequest } from "next/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return true;

  const fromBearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const fromHeader = request.headers.get("x-cron-secret")?.trim();
  return fromBearer === expected || fromHeader === expected;
}

/** Vercel Cron invokes GET with Authorization: Bearer CRON_SECRET. */
export function shouldExecuteCron(request: NextRequest): boolean {
  return isCronAuthorized(request);
}
