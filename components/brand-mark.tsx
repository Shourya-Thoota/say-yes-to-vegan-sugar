export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Say Yes to Vegan Sugar logo" className={className}>
      <circle cx="32" cy="32" r="30" fill="#F5F0E8" stroke="#E8865A" strokeWidth="2.5" />
      {/* bowl */}
      <path
        d="M14 30 h36 c0 9.5 -7.5 16 -18 16 s-18 -6.5 -18 -16 z"
        fill="#fff"
        stroke="#2D2D2D"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="30" rx="18" ry="5" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="2.5" />
      {/* sugar grains */}
      <circle cx="25" cy="22" r="2.2" fill="#E8865A" />
      <circle cx="31" cy="18" r="2.6" fill="#C05E33" />
      <circle cx="37" cy="22" r="2.2" fill="#E8865A" />
      <circle cx="28" cy="14" r="1.8" fill="#E8865A" />
      <circle cx="35" cy="13" r="1.6" fill="#9C4A26" />
      {/* base */}
      <rect x="27" y="47" width="10" height="4" rx="2" fill="#2D2D2D" />
    </svg>
  );
}

export function SugarBowlIllustration({ className = "w-full max-w-md" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 320" role="img" aria-label="Illustration of a bowl of sugar" className={className}>
      <ellipse cx="210" cy="272" rx="150" ry="18" fill="#EADFCB" />
      <path d="M70 150 h280 c0 70 -58 105 -140 105 s-140 -35 -140 -105 z" fill="#ffffff" stroke="#2D2D2D" strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="210" cy="150" rx="140" ry="38" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="5" />
      <ellipse cx="210" cy="150" rx="108" ry="26" fill="#F5F0E8" />
      <g fill="#E8865A">
        <circle cx="160" cy="138" r="7" />
        <circle cx="185" cy="128" r="8" />
        <circle cx="212" cy="122" r="9" />
        <circle cx="240" cy="130" r="8" />
        <circle cx="262" cy="140" r="7" />
        <circle cx="196" cy="142" r="6" />
        <circle cx="226" cy="142" r="6" />
      </g>
      <g fill="#C05E33">
        <circle cx="198" cy="112" r="5" />
        <circle cx="224" cy="108" r="5.5" />
        <circle cx="248" cy="118" r="4.5" />
        <circle cx="176" cy="116" r="4.5" />
      </g>
      <rect x="186" y="258" width="48" height="12" rx="6" fill="#2D2D2D" />
      <path d="M96 190 q-14 22 6 34" fill="none" stroke="#E8865A" strokeWidth="5" strokeLinecap="round" />
      <path d="M324 190 q14 22 -6 34" fill="none" stroke="#E8865A" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
