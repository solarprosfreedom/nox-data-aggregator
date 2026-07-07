import { NextRequest, NextResponse } from "next/server";
import {
  buildCoperniqWebhookRow,
  insertCoperniqWebhook,
} from "@/lib/coperniq/webhook";

const REDACTED_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-coperniq-webhook-secret",
  "x-webhook-secret",
]);

function normalizedText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text || null;
}

function requestHeaders(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    out[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return out;
}

function unauthorizedIfSecretMismatch(request: NextRequest): NextResponse | null {
  const expected = process.env.COPERNIQ_WEBHOOK_SECRET?.trim();
  if (!expected) return null;

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const supplied =
    normalizedText(request.headers.get("x-coperniq-webhook-secret")) ??
    normalizedText(request.headers.get("x-webhook-secret")) ??
    normalizedText(request.nextUrl.searchParams.get("secret")) ??
    normalizedText(request.nextUrl.searchParams.get("token")) ??
    normalizedText(bearer);

  if (supplied === expected) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    path: "/api/webhooks/coperniq",
    accepts: "POST application/json",
    auth: process.env.COPERNIQ_WEBHOOK_SECRET ? "optional secret configured" : "none",
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = unauthorizedIfSecretMismatch(request);
  if (unauthorized) return unauthorized;

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const row = buildCoperniqWebhookRow({
      payload,
      rawBody,
      requestHeaders: requestHeaders(request),
    });
    const id = await insertCoperniqWebhook(row);
    return NextResponse.json(
      {
        received: true,
        id,
        event_id: row.event_id,
        project_id: row.project_id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[coperniq webhook] insert failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Webhook storage failed" }, { status: 500 });
  }
}
