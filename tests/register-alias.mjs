import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function resolveWorkspacePath(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const withoutAlias = specifier.slice(2);
  const base = path.join(root, withoutAlias);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? pathToFileURL(found).href : null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache") {
      return nextResolve("next/cache.js", context);
    }
    const url = resolveWorkspacePath(specifier);
    if (url) return { url, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
