import assert from "node:assert/strict";
import test from "node:test";
import { mergeInstallerOptions } from "@/lib/data-hub/installers";

test("mergeInstallerOptions uses supported endpoint installers and de-dupes casing", () => {
  const options = mergeInstallerOptions(["Owe", "Axia Solar Corp", "GoodPwr", ""]);

  assert.deepEqual(options, [
    "Axia",
    "Axia Solar Corp",
    "Empwr",
    "GoodPwr",
    "Illum",
    "OWE",
    "Tron",
  ]);
  assert.equal(options.includes("INTY"), false);
  assert.equal(options.includes("LGCY"), false);
  assert.equal(options.includes("Sunergy"), false);
});
