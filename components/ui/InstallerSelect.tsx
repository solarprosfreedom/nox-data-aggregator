"use client";

type Props = {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: string[];
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
  className?: string;
};

export default function InstallerSelect({
  name = "installer",
  value = "",
  onChange,
  options,
  required,
  disabled,
  allowCustom = true,
  placeholder = "Select installer…",
  className,
}: Props) {
  const selectValue = value && options.includes(value) ? value : allowCustom && value ? "__custom__" : "";

  return (
    <div className={className}>
      <select
        name={selectValue === "__custom__" || (allowCustom && value && !options.includes(value)) ? undefined : name}
        value={selectValue}
        required={required && !allowCustom}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") {
            onChange?.("");
            return;
          }
          onChange?.(v);
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {allowCustom && <option value="__custom__">Other (type below)…</option>}
      </select>
      {allowCustom && (selectValue === "__custom__" || (value && !options.includes(value))) && (
        <input
          name={name}
          type="text"
          value={value}
          required={required}
          disabled={disabled}
          placeholder="Installer name"
          onChange={(e) => onChange?.(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      {!allowCustom && value && !options.includes(value) && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
