import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, className = "", children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconProjects(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7.5 12 3l9 4.5V18a1 1 0 0 1-.55.894L12 21l-8.45-2.106A1 1 0 0 1 3 18V7.5z" />
      <path d="M12 3v18M3 7.5 12 12l9-4.5" />
    </Icon>
  );
}

export function IconImport(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Icon>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function IconApps(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </Icon>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
    </Icon>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 18v2h16v-2" />
    </Icon>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 18v2h16v-2" />
    </Icon>
  );
}

export function IconSync(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4v5h5M20 20v-5h-5" />
      <path d="M20 9a8 8 0 0 0-14.9-3M4 15a8 8 0 0 0 14.9 3" />
    </Icon>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Icon>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </Icon>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.4 4.2L17.6 8 13.4 9.4 12 13.6 10.6 9.4 6.4 8l4.2-.8L12 3z" />
      <path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z" />
    </Icon>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </Icon>
  );
}
