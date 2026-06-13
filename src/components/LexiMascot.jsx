const sizeMap = {
  sm: 36,
  md: 72,
  lg: 108,
  xl: 144,
};

function LexiMascot({ className = "", size = "md", title }) {
  const dimension = sizeMap[size] ?? sizeMap.md;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={["lexi-mascot", className].filter(Boolean).join(" ")}
      height={dimension}
      role={title ? "img" : undefined}
      viewBox="0 0 120 120"
      width={dimension}
    >
      {title ? <title>{title}</title> : null}

      <defs>
        <linearGradient id="lexi-body" x1="20%" x2="80%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="lexi-book-cover" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="lexi-book-page" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="108" fill="rgba(37, 99, 235, 0.18)" rx="28" ry="5" />

      <g className="lexi-mascot-body">
        <path
          d="M60 18c-22 0-36 16-36 36 0 14 6 26 14 33v8c0 4 3 7 7 7h30c4 0 7-3 7-7v-8c8-7 14-19 14-33 0-20-14-36-36-36z"
          fill="url(#lexi-body)"
        />
        <path
          d="M34 52c2-10 12-18 26-18s24 8 26 18"
          fill="none"
          opacity="0.22"
          stroke="#fff"
          strokeWidth="3"
        />

        <ellipse cx="44" cy="58" fill="rgba(251, 113, 133, 0.35)" rx="6" ry="4" />
        <ellipse cx="76" cy="58" fill="rgba(251, 113, 133, 0.35)" rx="6" ry="4" />

        <circle cx="44" cy="52" fill="#fff" r="9" />
        <circle cx="76" cy="52" fill="#fff" r="9" />
        <circle cx="46" cy="52" fill="#0f172a" r="4.5" />
        <circle cx="78" cy="52" fill="#0f172a" r="4.5" />
        <circle cx="47.5" cy="50.5" fill="#fff" r="1.6" />
        <circle cx="79.5" cy="50.5" fill="#fff" r="1.6" />

        <path
          d="M48 66c4 4 20 4 24 0"
          fill="none"
          stroke="#1e3a8a"
          strokeLinecap="round"
          strokeWidth="3"
        />

        <g transform="translate(34 72)">
          <rect fill="url(#lexi-book-cover)" height="24" rx="3" width="52" x="0" y="0" />
          <path d="M26 0v24" stroke="#d97706" strokeWidth="1.5" />
          <rect fill="url(#lexi-book-page)" height="18" rx="1" width="22" x="4" y="3" />
          <rect fill="url(#lexi-book-page)" height="18" rx="1" width="22" x="28" y="3" />
          <path
            d="M10 9h10M10 13h8M34 9h8M34 13h10"
            stroke="#94a3b8"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
          <text
            fill="#1d4ed8"
            fontFamily="Inter, sans-serif"
            fontSize="11"
            fontWeight="800"
            x="8"
            y="21"
          >
            Lex
          </text>
        </g>

        <ellipse cx="28" cy="78" fill="#2563eb" rx="7" ry="9" />
        <ellipse cx="92" cy="78" fill="#2563eb" rx="7" ry="9" />
        <ellipse cx="48" cy="104" fill="#1e40af" rx="9" ry="6" />
        <ellipse cx="72" cy="104" fill="#1e40af" rx="9" ry="6" />
      </g>

      <g className="lexi-mascot-star">
        <path
          d="M60 6l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"
          fill="#fde047"
          stroke="#f59e0b"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

export default LexiMascot;
