"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSampleCsv } from "../actions";

export default function DeleteSampleButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this sample file?")) return;
        startTransition(async () => {
          const res = await deleteSampleCsv(id);
          if ("error" in res) {
            alert(res.error);
            return;
          }
          router.push("/samples");
          router.refresh();
        });
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
