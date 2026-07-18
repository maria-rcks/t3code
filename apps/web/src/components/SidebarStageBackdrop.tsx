export type SidebarStageBackdropVariant = "nightly" | "dev";

export function resolveSidebarStageBackdropVariant(
  stageLabel: string,
): SidebarStageBackdropVariant | null {
  const normalized = stageLabel.trim().toLowerCase();
  if (normalized === "nightly") return "nightly";
  if (normalized === "dev") return "dev";
  return null;
}

/**
 * Decorative stage-channel art rendered behind the sidebar header: a night sky
 * for nightly builds and blueprint paper for dev builds. Palettes mirror the
 * per-channel app icons in `assets/nightly` and `assets/dev`.
 */
export function SidebarStageBackdrop({ variant }: { variant: SidebarStageBackdropVariant }) {
  return (
    <div
      aria-hidden
      className="sidebar-stage-backdrop pointer-events-none absolute inset-x-0 top-0 z-0 h-24 select-none overflow-hidden"
    >
      {variant === "nightly" ? <NightlySkyArt /> : <DevBlueprintArt />}
    </div>
  );
}

const NIGHTLY_STARS: ReadonlyArray<{ cx: number; cy: number; r: number; delay: number }> = [
  { cx: 18, cy: 14, r: 1.1, delay: 0 },
  { cx: 44, cy: 34, r: 0.8, delay: 1.4 },
  { cx: 76, cy: 10, r: 0.9, delay: 2.6 },
  { cx: 108, cy: 26, r: 1.2, delay: 0.8 },
  { cx: 140, cy: 8, r: 0.7, delay: 3.2 },
  { cx: 168, cy: 30, r: 1, delay: 1.9 },
  { cx: 232, cy: 34, r: 0.8, delay: 2.2 },
  { cx: 34, cy: 52, r: 0.7, delay: 3.8 },
  { cx: 130, cy: 46, r: 0.8, delay: 0.4 },
  { cx: 250, cy: 12, r: 1, delay: 1.1 },
];

const NIGHTLY_SPARKLES: ReadonlyArray<{ x: number; y: number; delay: number }> = [
  { x: 60, y: 20, delay: 0.6 },
  { x: 152, y: 38, delay: 2.9 },
  { x: 244, y: 48, delay: 1.7 },
];

function NightlySkyArt() {
  return (
    <svg
      className="h-full w-full"
      fill="none"
      preserveAspectRatio="xMidYMin slice"
      viewBox="0 0 288 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="stage-night-sky"
          x1="24"
          y1="0"
          x2="264"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#07152F" />
          <stop offset="0.5" stopColor="#151443" />
          <stop offset="1" stopColor="#32155B" />
        </linearGradient>
        <radialGradient
          id="stage-night-glow"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(216 18) rotate(137) scale(120 84)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5165D8" stopOpacity="0.4" />
          <stop offset="0.5" stopColor="#283075" stopOpacity="0.16" />
          <stop offset="1" stopColor="#111635" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id="stage-night-cloud"
          x1="0"
          y1="60"
          x2="288"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4EA4FF" stopOpacity="0.5" />
          <stop offset="0.52" stopColor="#696FEA" stopOpacity="0.62" />
          <stop offset="1" stopColor="#A85BEA" stopOpacity="0.5" />
        </linearGradient>
        <filter
          id="stage-night-soft"
          x="-24"
          y="-24"
          width="336"
          height="144"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="288" height="96" fill="url(#stage-night-sky)" />
      <rect width="288" height="96" fill="url(#stage-night-glow)" />

      <g fill="#E4EAFF">
        {NIGHTLY_STARS.map((star) => (
          <circle
            key={`${star.cx}-${star.cy}`}
            className="stage-star"
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            style={{ animationDelay: `${star.delay}s` }}
          />
        ))}
      </g>
      <g stroke="#C8D7FF" strokeLinecap="round" strokeWidth="0.9">
        {NIGHTLY_SPARKLES.map((sparkle) => (
          <g
            key={`${sparkle.x}-${sparkle.y}`}
            className="stage-star"
            style={{ animationDelay: `${sparkle.delay}s` }}
          >
            <path d={`M${sparkle.x - 2.4} ${sparkle.y}H${sparkle.x + 2.4}`} />
            <path d={`M${sparkle.x} ${sparkle.y - 2.4}V${sparkle.y + 2.4}`} />
          </g>
        ))}
      </g>

      <g className="stage-moon">
        <circle cx="252" cy="26" r="16" fill="#F5E9C8" fillOpacity="0.14" />
        <path
          d="M258.5 15.5C253 15.5 248.5 20 248.5 25.5C248.5 31 253 35.5 258.5 35.5C260.4 35.5 262.2 35 263.7 34.1C260 33 257.3 29.6 257.3 25.5C257.3 21.4 260 18 263.7 16.9C262.2 16 260.4 15.5 258.5 15.5Z"
          fill="#F5E9C8"
          transform="rotate(24 256 25.5)"
        />
      </g>

      <g className="stage-cloud" filter="url(#stage-night-soft)">
        <path
          d="M-12 88C-12 74 0 63 14 63C18 50 30 41 44 41C58 41 70 49 74 62C79 57 86 54 94 54C110 54 123 66 124 82C132 83 138 88 141 96H-12V88Z"
          fill="url(#stage-night-cloud)"
        />
      </g>
      <g className="stage-cloud stage-cloud-far" filter="url(#stage-night-soft)">
        <path
          d="M150 96C151 84 161 75 173 75C176 64 186 57 198 57C210 57 220 64 223 75C231 75 238 80 241 87C250 87 257 91 260 96H150Z"
          fill="url(#stage-night-cloud)"
          fillOpacity="0.8"
        />
      </g>
    </svg>
  );
}

function DevBlueprintArt() {
  return (
    <svg
      className="stage-blueprint h-full w-full"
      fill="none"
      preserveAspectRatio="xMidYMin slice"
      viewBox="0 0 288 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="stage-bp-paper"
          x1="60"
          y1="0"
          x2="220"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop style={{ stopColor: "var(--stage-bp-top)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--stage-bp-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--stage-bp-bottom)" }} />
        </linearGradient>
        <radialGradient
          id="stage-bp-glow"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(216 14) rotate(137) scale(120 84)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#D4F6FF" stopOpacity="0.4" />
          <stop offset="0.52" stopColor="#65C8FF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#276AF1" stopOpacity="0" />
        </radialGradient>
        <pattern id="stage-bp-grid-minor" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" stroke="#EAF6FF" strokeOpacity="0.14" strokeWidth="0.5" />
        </pattern>
        <pattern id="stage-bp-grid-major" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" stroke="#EAF6FF" strokeOpacity="0.26" strokeWidth="0.6" />
        </pattern>
      </defs>

      <rect width="288" height="96" fill="url(#stage-bp-paper)" />
      <rect width="288" height="96" fill="url(#stage-bp-glow)" />
      <rect width="288" height="96" fill="url(#stage-bp-grid-minor)" />
      <rect width="288" height="96" fill="url(#stage-bp-grid-major)" />

      <g stroke="#DDF7FF" strokeLinecap="round" strokeOpacity="0.85" strokeWidth="0.8">
        <path className="stage-bp-dash" d="M20 16H120" strokeDasharray="6 4" />
        <path d="M20 12.5V19.5M120 12.5V19.5" />
        <path className="stage-bp-dash" d="M176 84H268" strokeDasharray="6 4" />
        <path d="M176 80.5V87.5M268 80.5V87.5" />
        <path className="stage-bp-dash" d="M262 12V52" strokeDasharray="5 4" strokeOpacity="0.6" />
      </g>

      <g stroke="#DDF7FF" strokeLinecap="round" strokeOpacity="0.7" strokeWidth="0.8">
        <g className="stage-bp-mark">
          <path d="M40 66L46 72M46 66L40 72" />
        </g>
        <g className="stage-bp-mark" style={{ animationDelay: "2.1s" }}>
          <path d="M226 30H236M231 25V35" />
        </g>
        <g className="stage-bp-mark" style={{ animationDelay: "4.3s" }}>
          <path d="M142 54H150M146 50V58" />
        </g>
      </g>

      <circle
        className="stage-bp-dash"
        cx="196"
        cy="40"
        r="17"
        stroke="#DDF7FF"
        strokeDasharray="4 5"
        strokeOpacity="0.45"
        strokeWidth="0.7"
      />
    </svg>
  );
}
