import type { SampleCsvDetail, SampleCsvListItem } from "@/lib/data-hub/samples";

export async function listSampleCsvFiles(
  limit = 100,
): Promise<SampleCsvListItem[]> {
  void limit;
  return [];
}

export async function getSampleCsvFile(id: string): Promise<SampleCsvDetail | null> {
  void id;
  return null;
}

export async function deleteSampleCsvFile(id: string): Promise<void> {
  void id;
}
