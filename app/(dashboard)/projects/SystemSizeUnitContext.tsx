"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  parseSystemSizeUnit,
  SYSTEM_SIZE_UNIT_STORAGE_KEY,
  type SystemSizeUnit,
} from "@/lib/data-hub/system-size-display";

type SystemSizeUnitContextValue = {
  unit: SystemSizeUnit;
  setUnit: (unit: SystemSizeUnit) => void;
  ready: boolean;
};

const SystemSizeUnitContext = createContext<SystemSizeUnitContextValue | null>(
  null,
);

function useSystemSizeUnitLocal(): SystemSizeUnitContextValue {
  const [unit, setUnitState] = useState<SystemSizeUnit>("w");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnitState(parseSystemSizeUnit(localStorage.getItem(SYSTEM_SIZE_UNIT_STORAGE_KEY)));
    setReady(true);
  }, []);

  const setUnit = useCallback((next: SystemSizeUnit) => {
    setUnitState(next);
    localStorage.setItem(SYSTEM_SIZE_UNIT_STORAGE_KEY, next);
  }, []);

  return useMemo(() => ({ unit, setUnit, ready }), [unit, setUnit, ready]);
}

export function SystemSizeUnitProvider({ children }: { children: ReactNode }) {
  const value = useSystemSizeUnitLocal();
  return (
    <SystemSizeUnitContext.Provider value={value}>
      {children}
    </SystemSizeUnitContext.Provider>
  );
}

export function useSystemSizeUnit(): SystemSizeUnitContextValue {
  const ctx = useContext(SystemSizeUnitContext);
  const local = useSystemSizeUnitLocal();
  return ctx ?? local;
}
