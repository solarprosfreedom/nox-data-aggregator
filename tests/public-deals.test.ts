import assert from "node:assert/strict";
import test from "node:test";
import {
  compactPublicDealObject,
  installerToPublicDealVendor,
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";
import {
  patchPublicDealFromHub,
  syncPublicDealFromHub,
} from "@/lib/data-hub/public-deals-sync";

test("maps installer names to public deal vendors", () => {
  assert.equal(installerToPublicDealVendor("Axia Solar Corp"), "axia");
  assert.equal(installerToPublicDealVendor("Good PWR"), "goodpwr");
  assert.equal(installerToPublicDealVendor("OWE"), "owe");
  assert.equal(installerToPublicDealVendor("Unknown Installer"), null);
});

test("compacts endpoint payload objects without dropping explicit nulls", () => {
  assert.deepEqual(
    compactPublicDealObject({
      project_id: "HES-1",
      empty: "",
      whitespace: "   ",
      clear_me: null,
      amount: 0,
      omitted: undefined,
    }),
    {
      project_id: "HES-1",
      clear_me: null,
      amount: 0,
    },
  );
});

test("resolves project identity from normalized project id before pk fallback", () => {
  const row = {
    vendor: "axia",
    installer: "Axia Solar Corp",
    pk: "hes_id",
    pk_value: "PK-1",
    project: { project_id: "HES-1" },
    remittance: null,
  } satisfies PublicDealRow;
  assert.equal(publicDealProjectId(row), "HES-1");
  assert.equal(publicDealProjectId({ ...row, project: {} }), "PK-1");
});

test("syncPublicDealFromHub writes normalized payloads to the vendor endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.PUBLIC_DEALS_API_BASE;
  const originalKey = process.env.PUBLIC_DEALS_API_KEY;
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  process.env.PUBLIC_DEALS_API_BASE = "https://example.test/api/public/deals";
  process.env.PUBLIC_DEALS_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBase == null) delete process.env.PUBLIC_DEALS_API_BASE;
    else process.env.PUBLIC_DEALS_API_BASE = originalBase;
    if (originalKey == null) delete process.env.PUBLIC_DEALS_API_KEY;
    else process.env.PUBLIC_DEALS_API_KEY = originalKey;
  });

  await syncPublicDealFromHub({
    installer: "Axia Solar Corp",
    project: {
      project_id: "HES-1",
      opportunity_name: "Ada Lovelace",
      installer: "Axia Solar Corp",
      updated_at: "2026-07-21T03:31:07.700Z",
      email: "",
    },
    remittance: {
      c0: 100,
      payment_status: "",
      c1_paid: null,
    },
    source: {
      fileName: "axia.csv",
      rowNumber: 12,
      rawRow: { Project: "HES-1" },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/api/public/deals/axia");
  assert.equal(calls[0].init?.method, "PUT");
  assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "test-key");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    project: {
      project_id: "HES-1",
      opportunity_name: "Ada Lovelace",
    },
    remittance: {
      c0: 100,
      c1_paid: null,
    },
    source: {
      file_name: "axia.csv",
      row_number: 12,
      raw_row: { Project: "HES-1" },
    },
  });
});

test("patchPublicDealFromHub excludes internal project metadata", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.PUBLIC_DEALS_API_BASE;
  const originalKey = process.env.PUBLIC_DEALS_API_KEY;
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  process.env.PUBLIC_DEALS_API_BASE = "https://example.test/api/public/deals";
  process.env.PUBLIC_DEALS_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBase == null) delete process.env.PUBLIC_DEALS_API_BASE;
    else process.env.PUBLIC_DEALS_API_BASE = originalBase;
    if (originalKey == null) delete process.env.PUBLIC_DEALS_API_KEY;
    else process.env.PUBLIC_DEALS_API_KEY = originalKey;
  });

  await patchPublicDealFromHub({
    installer: "Illum",
    project: {
      project_id: "hubspot_123",
      project_stage: "Contract Signed",
      installer: "Illum",
      updated_at: "2026-07-21T03:31:07.700Z",
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://example.test/api/public/deals/illum?id=hubspot_123",
  );
  assert.equal(calls[0].init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    project: {
      project_id: "hubspot_123",
      project_stage: "Contract Signed",
    },
    source: {},
  });
});
