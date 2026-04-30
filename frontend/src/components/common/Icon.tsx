import type { IconName } from "../../types/securityCenter";

interface IconProps {
  name?: IconName;
  className?: string;
}

export function Icon({ name = "circle", className = "h-5 w-5" }: IconProps) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  const paths: Record<IconName, JSX.Element> = {
    shield: (
      <>
        <path d="M12 3 5 6v6c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 18h.01" />
      </>
    ),
    network: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1" />
        <rect x="14" y="4" width="7" height="6" rx="1" />
        <rect x="8.5" y="15" width="7" height="6" rx="1" />
        <path d="M7 10v2h10v-2" />
        <path d="M12 12v3" />
      </>
    ),
    disk: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 4v6h8V4" />
        <path d="M8 16h8" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    bot: (
      <>
        <rect x="5" y="8" width="14" height="11" rx="2" />
        <path d="M12 8V4" />
        <path d="M8 13h.01" />
        <path d="M16 13h.01" />
        <path d="M9 17h6" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </>
    ),
    archive: (
      <>
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
        <path d="M10 13h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
      </>
    ),
    silence: (
      <>
        <path d="m3 3 18 18" />
        <path d="M9 21h6" />
        <path d="M17 17H5c1.5-1.5 2-3.3 2-6a5 5 0 0 1 1.2-3.4" />
        <path d="M14.8 5.4A5 5 0 0 1 17 11c0 1.4.1 2.6.5 3.7" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.2 2.2 4.8-5.4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    circle: <circle cx="12" cy="12" r="9" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2 4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2 4.2-4.2" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}
