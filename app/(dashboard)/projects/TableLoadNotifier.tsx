"use client";

import { useEffect } from "react";
import { useProjectsPagerOptional } from "./useProjectsPager";

/** Signals that server-rendered table content for this query is on screen. */
export default function TableLoadNotifier({ queryKey }: { queryKey: string }) {
  const pager = useProjectsPagerOptional();

  useEffect(() => {
    pager?.markTableLoaded(queryKey);
  }, [pager, queryKey]);

  return null;
}
