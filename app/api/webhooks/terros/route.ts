import { NextRequest, NextResponse, after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type TerrosPerson = {
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type TerrosAccountPayload = {
  id?: string;
  accountId?: string;
  resident?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  address?: {
    line1?: string;
    postal1?: string;
  };
  location?: {
    line1?: string;
    postal1?: string;
  };
  owner?: TerrosPerson;
  closer?: TerrosPerson;
};

type TerrosWebhookBody = {
  entity?: string;
  action?: string;
  data?: TerrosAccountPayload;
};

type TerrosUpsertRow = {
  account_id: string;
  opportunity_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  raw_terros: TerrosAccountPayload;
};

function normalizedEmail(value: string | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email ? email : null;
}

function normalizedText(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function fullName(person: TerrosPerson | undefined): string | null {
  if (!person) return null;
  const direct = normalizedText(person.name);
  if (direct) return direct;
  const first = normalizedText(person.firstName);
  const last = normalizedText(person.lastName);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

function residentName(resident: TerrosAccountPayload["resident"]): {
  opportunityName: string | null;
  firstName: string | null;
  lastName: string | null;
} {
  const firstName = normalizedText(resident?.firstName);
  const lastName = normalizedText(resident?.lastName);
  const direct = normalizedText(resident?.name);
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    opportunityName: direct || combined || null,
    firstName,
    lastName,
  };
}

function unauthorizedIfSecretMismatch(req: NextRequest): NextResponse | null {
  const expected = process.env.TERROS_WEBHOOK_SECRET?.trim();
  if (!expected) return null;
  const got =
    req.headers.get("x-terros-webhook-secret") ??
    req.headers.get("x-webhook-secret") ??
    "";
  if (got === expected) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function buildUpsertRow(accountId: string, data: TerrosAccountPayload): TerrosUpsertRow {
  const address = data.address ?? data.location;
  const setterName = fullName(data.owner);
  const closerName = fullName(data.closer);
  const resident = residentName(data.resident);

  return {
    account_id: accountId,
    opportunity_name: resident.opportunityName,
    first_name: resident.firstName,
    last_name: resident.lastName,
    email: normalizedEmail(data.resident?.email),
    phone: normalizedText(data.resident?.phone),
    address_line1: normalizedText(address?.line1),
    postal_code: normalizedText(address?.postal1),
    setter_name: setterName,
    setter_email: normalizedEmail(data.owner?.email),
    closer_name: closerName,
    raw_terros: data,
  };
}

async function upsertTerrosAccount(row: TerrosUpsertRow): Promise<void> {
  const db = createServerSupabase();
  const { error } = await db.from("terros_accounts").upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: "account_id", ignoreDuplicates: false },
  );
  if (error) {
    console.error("[terros webhook] upsert failed:", row.account_id, error.message);
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    path: "/api/webhooks/terros",
    accepts: [{ entity: "Account", actions: ["add", "update"] }],
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = unauthorizedIfSecretMismatch(req);
  if (unauthorized) return unauthorized;

  let body: TerrosWebhookBody;
  try {
    body = (await req.json()) as TerrosWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entity = normalizedText(body.entity);
  const action = (body.action ?? "").trim().toLowerCase();
  const data = body.data;

  if (entity !== "Account" || (action !== "add" && action !== "update")) {
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: "Unsupported entity/action",
    });
  }

  const accountId = normalizedText(data?.id) ?? normalizedText(data?.accountId);
  if (!accountId || !data) {
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: "Missing account id or data payload",
    });
  }

  const upsertRow = buildUpsertRow(accountId, data);

  // Respond immediately — Terros retries on ~10s timeout; slow Supabase upserts
  // on nano were causing retry storms and API errors.
  after(async () => {
    await upsertTerrosAccount(upsertRow);
  });

  return NextResponse.json({
    received: true,
    queued: true,
    entity,
    action,
    account_id: accountId,
  });
}
