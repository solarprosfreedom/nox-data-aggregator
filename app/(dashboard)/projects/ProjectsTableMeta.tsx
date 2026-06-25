"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TableMetaContextValue = {
  total: number | null;
  setTotal: (total: number | null) => void;
};

const TableMetaContext = createContext<TableMetaContextValue | null>(null);

export function ProjectsTableMetaProvider({ children }: { children: ReactNode }) {
  const [total, setTotal] = useState<number | null>(null);
  const value = useMemo(() => ({ total, setTotal }), [total]);
  return <TableMetaContext.Provider value={value}>{children}</TableMetaContext.Provider>;
}

export function useProjectsTableTotal() {
  const ctx = useContext(TableMetaContext);
  if (!ctx) throw new Error("useProjectsTableTotal must be used within ProjectsTableMetaProvider");
  return ctx.total;
}

/** Published by the server table when rows + total are ready. */
export function TableTotalNotifier({ total }: { total: number }) {
  const ctx = useContext(TableMetaContext);
  useEffect(() => {
    ctx?.setTotal(total);
    return () => ctx?.setTotal(null);
  }, [ctx, total]);
  return null;
}
