export type BackfillStateResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

export async function backfillProjectStateCodes(): Promise<BackfillStateResult> {
  return { scanned: 0, updated: 0, skipped: 0 };
}
