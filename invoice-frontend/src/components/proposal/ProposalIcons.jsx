// Small stroke icons used only by the Proposal Builder.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export const IconGrip = ({ className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    {[7, 12, 17].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
  </svg>
);
export const IconCopy = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
);
export const IconTrash = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const IconUp = ({ className = "h-4 w-4" }) => (<svg {...base} className={className}><path d="M6 15l6-6 6 6" /></svg>);
export const IconDown = ({ className = "h-4 w-4" }) => (<svg {...base} className={className}><path d="M6 9l6 6 6-6" /></svg>);
export const IconX = ({ className = "h-4 w-4" }) => (<svg {...base} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconTable = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>
);
export const IconText = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><path d="M5 5h14M12 5v14M9 19h6" /></svg>
);
export const IconShield = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconDownload = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
);
export const IconEye = ({ className = "h-4 w-4" }) => (
  <svg {...base} className={className}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" /></svg>
);
export const IconChevronRight = ({ className = "h-4 w-4" }) => (<svg {...base} className={className}><path d="M9 6l6 6-6 6" /></svg>);
