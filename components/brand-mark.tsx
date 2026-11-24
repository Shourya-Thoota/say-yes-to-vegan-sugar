export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Temple Initiative logo" className={className}>
      <circle cx="32" cy="32" r="30" fill="#F5F0E8" stroke="#E8865A" strokeWidth="2.5" />
      {/* temple arch above the bowl */}
      <path
        d="M18 24 C24 14 40 14 46 24"
        fill="none"
        stroke="#2D2D2D"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="16" r="2.4" fill="#9C4A26" />
      {/* bowl */}
      <path
        d="M14 32 h36 c0 9.5 -7.5 16 -18 16 s-18 -6.5 -18 -16 z"
        fill="#fff"
        stroke="#2D2D2D"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="32" rx="18" ry="5" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="2.5" />
      {/* sugar grains */}
      <circle cx="25" cy="24" r="2.2" fill="#E8865A" />
      <circle cx="31" cy="20" r="2.6" fill="#C05E33" />
      <circle cx="37" cy="24" r="2.2" fill="#E8865A" />
      <rect x="27" y="49" width="10" height="4" rx="2" fill="#2D2D2D" />
    </svg>
  );
}

export function TempleHeroIllustration({ className = "w-full max-w-md" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label="Editorial illustration: temple arch, bowl of sugar, and a generic package checklist"
      className={className}
    >
      <rect x="8" y="8" width="464" height="344" rx="24" fill="#EFE7D8" />
      <rect x="8" y="8" width="464" height="344" rx="24" fill="none" stroke="#D8CCB8" strokeWidth="2" />
      <path d="M52 292 V168 a92 92 0 0 1 184 0 v124" fill="#F5F0E8" stroke="#C9B895" strokeWidth="3" />
      <path
        d="M76 292 V176 a68 68 0 0 1 136 0 v116"
        fill="none"
        stroke="#C9B895"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
      <circle cx="144" cy="62" r="7" fill="#9C4A26" />
      <line x1="112" y1="62" x2="66" y2="62" stroke="#9C4A26" strokeWidth="4" strokeLinecap="round" />
      <line x1="176" y1="62" x2="222" y2="62" stroke="#9C4A26" strokeWidth="4" strokeLinecap="round" />
      <rect x="40" y="288" width="208" height="14" rx="7" fill="#2D2D2D" />
      <path
        d="M84 232 h120 c0 40 -27 58 -60 58 s-60 -18 -60 -58 z"
        fill="#fff"
        stroke="#2D2D2D"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <ellipse cx="144" cy="232" rx="60" ry="17" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="5" />
      <g fill="#E8865A">
        <circle cx="122" cy="224" r="6" />
        <circle cx="144" cy="216" r="7" />
        <circle cx="166" cy="224" r="6" />
      </g>
      <g fill="#C05E33">
        <circle cx="133" cy="220" r="3" />
        <circle cx="155" cy="221" r="3" />
      </g>
      <g>
        <rect x="268" y="72" width="172" height="216" rx="14" fill="#fff" stroke="#2D2D2D" strokeWidth="4" />
        <rect x="268" y="72" width="172" height="44" rx="14" fill="#2D2D2D" />
        <rect x="268" y="100" width="172" height="16" fill="#2D2D2D" />
        <text x="288" y="100" fontFamily="Georgia, serif" fontSize="19" fontWeight="bold" fill="#fff">
          Package check
        </text>
        <g>
          <circle cx="292" cy="140" r="11" fill="none" stroke="#9C4A26" strokeWidth="3" />
          <path d="M287 140 l4 4 l7 -8" fill="none" stroke="#9C4A26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="312" y="146" fontFamily="Calibri, sans-serif" fontSize="15" fill="#4A4238">maker · product</text>
        </g>
        <g>
          <circle cx="292" cy="178" r="11" fill="none" stroke="#9C4A26" strokeWidth="3" />
          <path d="M287 178 l4 4 l7 -8" fill="none" stroke="#9C4A26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="312" y="184" fontFamily="Calibri, sans-serif" fontSize="15" fill="#4A4238">package · date</text>
        </g>
        <g>
          <circle cx="292" cy="216" r="11" fill="none" stroke="#9C4A26" strokeWidth="3" />
          <path d="M287 216 l4 4 l7 -8" fill="none" stroke="#9C4A26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="312" y="222" fontFamily="Calibri, sans-serif" fontSize="15" fill="#4A4238">maker reply</text>
        </g>
        <text x="288" y="262" fontFamily="Calibri, sans-serif" fontSize="12" fill="#6B5E4F">
          Generic example — not a real label
        </text>
      </g>
    </svg>
  );
}
