import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicImportLog,
  listPublicImportHistory,
} from "@/lib/public-imports/client";

test("reads and normalizes merged public import history with filters", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.PUBLIC_IMPORTS_API_BASE;
  const originalKey = process.env.PUBLIC_IMPORTS_API_KEY;
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  process.env.PUBLIC_IMPORTS_API_BASE = "https://example.test/api/public/imports";
  process.env.PUBLIC_IMPORTS_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "import-1",
            source: "tron",
            row_count: 8,
            inserted_count: 3,
            updated_count: 4,
            filename: "tron.csv",
            trigger_source: "cron",
            created_at: "2026-01-02T03:04:05.000Z",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBase == null) delete process.env.PUBLIC_IMPORTS_API_BASE;
    else process.env.PUBLIC_IMPORTS_API_BASE = originalBase;
    if (originalKey == null) delete process.env.PUBLIC_IMPORTS_API_KEY;
    else process.env.PUBLIC_IMPORTS_API_KEY = originalKey;
  });

  const rows = await listPublicImportHistory({
    source: ["axia", "tron"],
    limit: 50,
    since: "2026-01-01",
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://example.test/api/public/imports?source=axia%2Ctron&limit=50&since=2026-01-01",
  );
  assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "test-key");
  assert.deepEqual(rows, [
    {
      id: "import-1",
      source: "tron",
      row_count: 8,
      inserted_count: 3,
      updated_count: 4,
      filename: "tron.csv",
      trigger_source: "cron",
      error: null,
      created_at: "2026-01-02T03:04:05.000Z",
    },
  ]);
});

test("posts an installer import record to the public imports endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.PUBLIC_IMPORTS_API_BASE;
  const originalKey = process.env.PUBLIC_IMPORTS_API_KEY;
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  process.env.PUBLIC_IMPORTS_API_BASE = "https://example.test/api/public/imports";
  process.env.PUBLIC_IMPORTS_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ id: "import-2" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBase == null) delete process.env.PUBLIC_IMPORTS_API_BASE;
    else process.env.PUBLIC_IMPORTS_API_BASE = originalBase;
    if (originalKey == null) delete process.env.PUBLIC_IMPORTS_API_KEY;
    else process.env.PUBLIC_IMPORTS_API_KEY = originalKey;
  });

  await createPublicImportLog({
    source: "axia",
    row_count: 10,
    inserted_count: 2,
    updated_count: 7,
    filename: "axia.csv",
    trigger_source: "manual_upload",
    error: "1 row skipped",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/api/public/imports");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "test-key");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    source: "axia",
    row_count: 10,
    inserted_count: 2,
    updated_count: 7,
    filename: "axia.csv",
    trigger_source: "manual_upload",
    error: "1 row skipped",
  });
});
