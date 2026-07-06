import assert from "node:assert/strict";
import test from "node:test";
import { runSequifiSync } from "@/lib/sequifi/sync";

test("runSequifiSync does not pull Sequifi-only sales into endpoint data", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalPublicBase = process.env.PUBLIC_DEALS_API_BASE;
  const originalPublicKey = process.env.PUBLIC_DEALS_API_KEY;
  const originalSequifiBase = process.env.SEQUIFI_API_BASE_URL;
  const originalSequifiToken = process.env.SEQUIFI_ACCESS_TOKEN;
  const publicBase = "https://public.example.test/api/public/deals";
  const sequifiBase = "https://sequifi.example.test";
  const calls: { url: string; method: string; body?: string }[] = [];

  process.env.PUBLIC_DEALS_API_BASE = publicBase;
  process.env.PUBLIC_DEALS_API_KEY = "public-test-key";
  process.env.SEQUIFI_API_BASE_URL = sequifiBase;
  process.env.SEQUIFI_ACCESS_TOKEN = "sequifi-test-token";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    if (url.startsWith(publicBase)) {
      const vendor = new URL(url).pathname.split("/").pop();
      if (method === "GET") {
        return Response.json({
          data:
            vendor === "axia"
              ? [
                  {
                    vendor: "axia",
                    installer: "Axia",
                    pk: "hes_id",
                    pk_value: "HUB-1",
                    project: {
                      project_id: "HUB-1",
                      opportunity_name: "Endpoint Customer",
                      state_code: "CA",
                      address_line1: "1 Test St",
                      postal_code: "90001",
                      system_size_kw: 5,
                      total_system_cost: 20000,
                      contract_signed_date: "2026-07-01",
                      installer: "Axia",
                      project_stage: "Contract Signed",
                    },
                    remittance: null,
                  },
                ]
              : [],
          hasMore: false,
          page: 1,
          limit: 5000,
        });
      }

      if (method === "PATCH") {
        return Response.json({ ok: true });
      }

      return Response.json(
        { error: `Unexpected public deals ${method}` },
        { status: 500 },
      );
    }

    if (url.startsWith(`${sequifiBase}/v1/sales`)) {
      if (method === "GET") {
        return Response.json({
          data: {
            Sales: [
              {
                id: 10,
                pid: "SEQ-ONLY",
                customer_name: "Sequifi Only Customer",
                customer_state: "CA",
                kw: 4,
                gross_account_value: 18000,
                customer_signoff: "2026-06-01",
                install_partner: "Axia",
                job_status: "Signed",
              },
            ],
            last_page: 1,
          },
        });
      }

      if (method === "POST") {
        return Response.json({
          data: {
            recordsInserted: 1,
            recordsPatched: 0,
            recordsProcessed: 1,
          },
        });
      }
    }

    return Response.json({ error: `Unexpected request ${method} ${url}` }, { status: 500 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalPublicBase == null) delete process.env.PUBLIC_DEALS_API_BASE;
    else process.env.PUBLIC_DEALS_API_BASE = originalPublicBase;
    if (originalPublicKey == null) delete process.env.PUBLIC_DEALS_API_KEY;
    else process.env.PUBLIC_DEALS_API_KEY = originalPublicKey;
    if (originalSequifiBase == null) delete process.env.SEQUIFI_API_BASE_URL;
    else process.env.SEQUIFI_API_BASE_URL = originalSequifiBase;
    if (originalSequifiToken == null) delete process.env.SEQUIFI_ACCESS_TOKEN;
    else process.env.SEQUIFI_ACCESS_TOKEN = originalSequifiToken;
  });

  const result = await runSequifiSync({ dryRun: false });

  assert.equal("error" in result, false);
  if ("error" in result) return;

  assert.equal(result.projectsScanned, 1);
  assert.equal(result.sequifiSales, 1);
  assert.equal(result.pushedNew, 1);
  assert.equal(result.pushedUpdate, 0);
  assert.equal(Object.hasOwn(result, "pulledNew"), false);
  assert.equal(Object.hasOwn(result.samples, "pull"), false);

  const sequifiPost = calls.find(
    (call) => call.url === `${sequifiBase}/v1/sales` && call.method === "POST",
  );
  assert.ok(sequifiPost);
  assert.deepEqual(
    JSON.parse(sequifiPost.body ?? "{}").data.map((row: { pid: string }) => row.pid),
    ["HUB-1"],
  );

  const publicWrites = calls.filter(
    (call) => call.url.startsWith(publicBase) && call.method !== "GET",
  );
  assert.deepEqual(
    publicWrites.map((call) => call.method),
    ["PATCH"],
  );
  assert.equal(
    publicWrites.some((call) => call.body?.includes("SEQ-ONLY")),
    false,
  );
});
