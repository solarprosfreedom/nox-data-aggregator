import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json(
      { received: true, skipped: true, reason: "Missing account id or data payload" },
      { status: 200 }
    );
  }

  const address = data.address ?? data.location;
  const setterName = fullName(data.owner);
  const closerName = fullName(data.closer);
  const resident = residentName(data.resident);

  const upsertRow = {
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
    // Keep raw_terros as the account object so existing matcher helpers
    // (ownerEmailFromRaw/closerEmailFromRaw) can read owner/closer directly.
    raw_terros: data,
  };

  try {
    const db = createServerSupabase();
    const { error } = await db.from("terros_accounts").upsert(upsertRow, {
      onConflict: "account_id",
      ignoreDuplicates: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      entity,
      action,
      account_id: accountId,
      upserted: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
