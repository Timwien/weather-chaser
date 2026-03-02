/** Inline SVG icon components for the Finder UI — no external dependency required. */

interface IconProps {
  size?: number;
}

const base: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  flexShrink: 0,
};

export function SunIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={base}>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      {/* 8 rays */}
      <line x1="8" y1="0.8" x2="8" y2="3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12.8" x2="8" y2="15.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0.8" y1="8" x2="3.2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12.8" y1="8" x2="15.2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2.8" y1="2.8" x2="4.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11.5" y1="11.5" x2="13.2" y2="13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13.2" y1="2.8" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.5" y1="11.5" x2="2.8" y2="13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TempIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={base}>
      {/* tube outline */}
      <rect x="6.5" y="1" width="3" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      {/* mercury fill */}
      <rect x="7.2" y="6" width="1.6" height="4" rx="0.6" fill="currentColor" />
      {/* bulb */}
      <circle cx="8" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function RainIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={base}>
      {/* teardrop / droplet */}
      <path
        d="M8 1.5 C8 1.5 3.5 8 3.5 10.5 a4.5 4.5 0 0 0 9 0 C12.5 8 8 1.5 8 1.5Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function WindIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={base}>
      {/* top line with curl */}
      <path d="M1 5 L11.5 5 Q14 5 14 3 Q14 1 12 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* middle line */}
      <line x1="1" y1="8.5" x2="13" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* bottom line with curl */}
      <path d="M1 12 L9 12 Q11.5 12 11.5 14 Q11.5 15.5 10 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function ScoreIcon({ size = 13 }: IconProps) {
  // 5-pointed star
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={base}>
      <polygon
        points="8,1.5 9.6,5.8 14.2,6.0 10.6,8.8 11.8,13.3 8,10.7 4.2,13.3 5.4,8.8 1.8,6.0 6.4,5.8"
        fill="currentColor"
      />
    </svg>
  );
}

export function TrophyIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={base}>
      {/* cup body */}
      <path d="M4 2 h8 v5 a4 4 0 0 1-8 0 V2Z" fill="#FFD700" stroke="#C8960A" strokeWidth="0.8" />
      {/* left handle */}
      <path d="M4 3 H2 a2 2 0 0 0 2 2" stroke="#C8960A" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* right handle */}
      <path d="M12 3 H14 a2 2 0 0 1-2 2" stroke="#C8960A" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* stem */}
      <line x1="8" y1="8" x2="8" y2="11" stroke="#C8960A" strokeWidth="1.3" strokeLinecap="round" />
      {/* base */}
      <line x1="5" y1="11" x2="11" y2="11" stroke="#C8960A" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5.5" y1="13" x2="10.5" y2="13" stroke="#C8960A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
