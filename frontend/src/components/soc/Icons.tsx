/* SOC Icons — line/duotone, currentColor, stroke 1.7 */

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  sw?: number;
  fill?: string;
}

const SCIcon = ({ d, size = 16, sw = 1.7, fill = "none", className, style }: IconProps & { d: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
    style={style}
  >
    {d}
  </svg>
);

export const Icons = {
  shield: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/></>} />,
  shieldChk: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/></>} />,
  alert: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 3 2 20h20Z"/><path d="M12 10v5M12 18v.5"/></>} />,
  bell: (p: IconProps) => <SCIcon {...p} d={<><path d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3Z"/><path d="M10 19a2 2 0 0 0 4 0"/></>} />,
  fire: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 3c1 4 4 5 4 9a4 4 0 1 1-8 0c0-2 1-3 1-5 0 2 2 3 3 4 0-3-1-5 0-8Z"/></>} />,
  bug: (p: IconProps) => <SCIcon {...p} d={<><rect x="6" y="8" width="12" height="11" rx="6"/><path d="M9 8V6a3 3 0 0 1 6 0v2M3 12h3M18 12h3M4 18l2-1M20 18l-2-1M4 7l3 1M20 7l-3 1M12 14v5"/></>} />,
  lock: (p: IconProps) => <SCIcon {...p} d={<><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>} />,
  unlock: (p: IconProps) => <SCIcon {...p} d={<><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></>} />,
  user: (p: IconProps) => <SCIcon {...p} d={<><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></>} />,
  users: (p: IconProps) => <SCIcon {...p} d={<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M14.5 20a5 5 0 0 1 7-4.5"/></>} />,
  server: (p: IconProps) => <SCIcon {...p} d={<><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r=".7" fill="currentColor"/><circle cx="7" cy="17" r=".7" fill="currentColor"/></>} />,
  network: (p: IconProps) => <SCIcon {...p} d={<><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v3M12 12 6.5 17.5M12 12l5.5 5.5"/></>} />,
  globe: (p: IconProps) => <SCIcon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>} />,
  mail: (p: IconProps) => <SCIcon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>} />,
  inbox: (p: IconProps) => <SCIcon {...p} d={<><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="m3 13 3-9h12l3 9M3 13h5l1.5 2h5L16 13h5"/></>} />,
  file: (p: IconProps) => <SCIcon {...p} d={<><path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/></>} />,
  fileText: (p: IconProps) => <SCIcon {...p} d={<><path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4M9 13h6M9 16h6"/></>} />,
  search: (p: IconProps) => <SCIcon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m21 21-5-5"/></>} />,
  settings: (p: IconProps) => <SCIcon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></>} />,
  bolt: (p: IconProps) => <SCIcon {...p} d={<path d="M13 3 4 14h6l-1 7 9-11h-6Z"/>} />,
  bot: (p: IconProps) => <SCIcon {...p} d={<><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6"/><path d="M2 13v3M22 13v3"/></>} />,
  sparkles: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></>} />,
  send: (p: IconProps) => <SCIcon {...p} d={<path d="M4 12 21 4l-4 17-4-7Z"/>} />,
  chevR: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="m9 6 6 6-6 6"/>} />,
  chevD: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="m6 9 6 6 6-6"/>} />,
  chevU: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="m6 15 6-6 6 6"/>} />,
  arrowUp: (p: IconProps) => <SCIcon {...p} sw={2} d={<><path d="M12 19V5M5 12l7-7 7 7"/></>} />,
  arrowDn: (p: IconProps) => <SCIcon {...p} sw={2} d={<><path d="M12 5v14M5 12l7 7 7-7"/></>} />,
  arrowR: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="M5 12h14M13 5l7 7-7 7"/>} />,
  plus: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="M12 5v14M5 12h14"/>} />,
  x: (p: IconProps) => <SCIcon {...p} sw={2} d={<path d="M6 6l12 12M18 6 6 18"/>} />,
  check: (p: IconProps) => <SCIcon {...p} sw={2.2} d={<path d="m4 12 5 5 11-11"/>} />,
  dot: (p: IconProps) => <SCIcon {...p} fill="currentColor" d={<circle cx="12" cy="12" r="4"/>} />,
  more: (p: IconProps) => <SCIcon {...p} fill="currentColor" d={<><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></>} />,
  filter: (p: IconProps) => <SCIcon {...p} d={<path d="M3 5h18l-7 9v6l-4-2v-4Z"/>} />,
  refresh: (p: IconProps) => <SCIcon {...p} d={<><path d="M4 12a8 8 0 0 1 14-5.5L21 8"/><path d="M21 4v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.5L3 16"/><path d="M3 20v-4h4"/></>} />,
  clock: (p: IconProps) => <SCIcon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  calendar: (p: IconProps) => <SCIcon {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>} />,
  tag: (p: IconProps) => <SCIcon {...p} d={<><path d="m4 12 8-8h7v7l-8 8Z"/><circle cx="15.5" cy="8.5" r="1.2"/></>} />,
  flag: (p: IconProps) => <SCIcon {...p} d={<><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></>} />,
  archive: (p: IconProps) => <SCIcon {...p} d={<><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 13h4"/></>} />,
  link: (p: IconProps) => <SCIcon {...p} d={<><path d="M9 15a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1.5 1.5"/><path d="M15 9a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1.5-1.5"/></>} />,
  ext: (p: IconProps) => <SCIcon {...p} d={<><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></>} />,
  copy: (p: IconProps) => <SCIcon {...p} d={<><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3"/></>} />,
  play: (p: IconProps) => <SCIcon {...p} fill="currentColor" d={<path d="M7 4v16l13-8Z"/>} />,
  pause: (p: IconProps) => <SCIcon {...p} fill="currentColor" d={<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>} />,
  eye: (p: IconProps) => <SCIcon {...p} d={<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.8"/></>} />,
  cpu: (p: IconProps) => <SCIcon {...p} d={<><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></>} />,
  database: (p: IconProps) => <SCIcon {...p} d={<><ellipse cx="12" cy="5" rx="8" ry="2.5"/><path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/></>} />,
  grid: (p: IconProps) => <SCIcon {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />,
  list: (p: IconProps) => <SCIcon {...p} d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></>} />,
  stack: (p: IconProps) => <SCIcon {...p} d={<><path d="m12 4 9 5-9 5-9-5Z"/><path d="m3 14 9 5 9-5M3 9v8"/></>} />,
  trend: (p: IconProps) => <SCIcon {...p} d={<><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></>} />,
  microsoft: (p: IconProps) => <SCIcon {...p} fill="currentColor" sw={0} d={<><rect x="3" y="3" width="8.5" height="8.5"/><rect x="12.5" y="3" width="8.5" height="8.5"/><rect x="3" y="12.5" width="8.5" height="8.5"/><rect x="12.5" y="12.5" width="8.5" height="8.5"/></>} />,
  windows: (p: IconProps) => <SCIcon {...p} fill="currentColor" sw={0} d={<><path d="M3 5.5 11 4.3v7.5H3z"/><path d="M11.6 4.2 21 3v8.7h-9.4z"/><path d="M3 12.4h8v7.4L3 18.5z"/><path d="M11.6 12.4H21V21l-9.4-1.3z"/></>} />,
  logout: (p: IconProps) => <SCIcon {...p} d={<><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>} />,
  silence: (p: IconProps) => <SCIcon {...p} d={<><path d="M6 8a6 6 0 0 1 11.5-2.4"/><path d="M18 8v5l2 3H4l2-3V8"/><path d="m3 3 18 18"/></>} />,
  flame: (p: IconProps) => <SCIcon {...p} d={<path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-5 1 1 2 2 3 2 0-2-1-4 1-7Z"/>} />,
  download: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 4v12M6 12l6 6 6-6"/><path d="M4 20h16"/></>} />,
  trash: (p: IconProps) => <SCIcon {...p} d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></>} />,
  pin: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 2v8l3 3v3H9v-3l3-3V2Z"/><path d="M12 16v6"/></>} />,
  branch: (p: IconProps) => <SCIcon {...p} d={<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8M12 14v2"/></>} />,
  moon: (p: IconProps) => <SCIcon {...p} d={<><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></>} />,
  sun: (p: IconProps) => <SCIcon {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>} />,
};

export default Icons;
