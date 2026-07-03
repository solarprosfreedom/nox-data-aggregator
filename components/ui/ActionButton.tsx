import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "border border-cyan-600 bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 hover:border-cyan-700",
  secondary:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "border border-transparent text-slate-600 hover:bg-slate-100",
};

export default function ActionButton({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
