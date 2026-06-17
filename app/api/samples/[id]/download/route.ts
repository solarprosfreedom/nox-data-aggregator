import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/profile";
import { getSampleCsvFile } from "@/lib/data-hub/sample-queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const sample = await getSampleCsvFile(id);
  if (!sample) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(sample.file_content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sample.file_name.replace(/"/g, "")}"`,
    },
  });
}
