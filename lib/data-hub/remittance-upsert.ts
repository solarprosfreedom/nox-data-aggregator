/** Keys always sent on remittance upsert (identity + audit). */
const REMITTANCE_UPSERT_REQUIRED = new Set([
  "hes_code",
  "file_name",
  "file_hash",
  "raw_row",
  "imported_at",
]);

/** Drop empty CSV values so re-imports only overwrite fields present in the file. */
export function remittanceUpsertPayload(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("_")) continue;

    if (REMITTANCE_UPSERT_REQUIRED.has(key)) {
      out[key] = value;
      continue;
    }

    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    out[key] = value;
  }

  if (row.project_id) {
    out.project_id = row.project_id;
  }

  return out;
}

export function omitEmptyPatchFields<T extends Record<string, unknown>>(
  patch: T,
  alwaysKeep: readonly string[] = [],
): Partial<T> {
  const keep = new Set(alwaysKeep);
  const out: Partial<T> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (keep.has(key)) {
      (out as Record<string, unknown>)[key] = value;
      continue;
    }
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    (out as Record<string, unknown>)[key] = value;
  }

  return out;
}
