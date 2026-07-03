"use client";

import { useState } from "react";
import { IconImport, IconMap } from "@/components/ui/icons";

export default function ImportsTabs({
  quickImport,
  fieldMapper,
}: {
  quickImport: React.ReactNode;
  fieldMapper: React.ReactNode;
}) {
  const [tab, setTab] = useState<"quick" | "mapper">("quick");

  return (
    <>
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <TabBtn
          active={tab === "quick"}
          onClick={() => setTab("quick")}
          icon={<IconImport size={16} />}
        >
          Quick Import
        </TabBtn>
        <TabBtn
          active={tab === "mapper"}
          onClick={() => setTab("mapper")}
          icon={<IconMap size={16} />}
        >
          Field Mapper
        </TabBtn>
      </div>

      {tab === "quick" && quickImport}
      {tab === "mapper" && fieldMapper}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
