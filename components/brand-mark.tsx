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
    <svg viewBox="0 0 460 340" role="img" aria-label="Original editorial illustration: a temple arch, a bowl of sugar, and a product label being checked" className={className}>
      <rect x="16" y="16" width="428" height="308" rx="20" fill="#EFE7D8" />
      <line x1="48" y1="76" x2="180" y2="76" stroke="#9C4A26" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 150 v-24 a60 60 0 0 1 120 0 v24" fill="none" stroke="#2D2D2D" strokeWidth="6" strokeLinecap="round" />
      <rect x="48" y="148" width="144" height="12" rx="6" fill="#2D2D2D" />
      <path d="M90 220 h120 c0 42 -27 62 -60 62 s-60 -20 -60 -62 z" fill="#fff" stroke="#2D2D2D" strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="150" cy="220" rx="60" ry="17" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="5" />
      <g fill="#E8865A">
        <circle cx="128" cy="212" r="6" />
        <circle cx="150" cy="204" r="7" />
        <circle cx="172" cy="212" r="6" />
      </g>
      <g fill="none" stroke="#2D2D2D" strokeWidth="5">
        <rect x="252" y="120" width="156" height="132" rx="12" fill="#fff" />
      </g>
      <text x="272" y="152" fontFamily="Georgia, serif" fontSize="20" fontWeight="bold" fill="#2D2D2D">Check the</text>
      <text x="272" y="176" fontFamily="Georgia, serif" fontSize="20" fontWeight="bold" fill="#2D2D2D">label</text>
      <line x1="272" y1="192" x2="388" y2="192" stroke="#E8865A" strokeWidth="4" strokeLinecap="round" />
      <text x="272" y="216" fontFamily="Calibri, sans-serif" fontSize="16" fill="#4A4238">maker · product</text>
      <text x="272" y="238" fontFamily="Calibri, sans-serif" fontSize="16" fill="#4A4238">package · date</text>
    </svg>
  );
}
