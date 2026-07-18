import { useAtomValue } from "@effect/atom-react";

import { APP_STAGE_LABEL } from "../branding";
import { resolveServerBackedAppStageLabel } from "../branding.logic";
import { primaryServerConfigAtom } from "../state/server";

export type SidebarStageBackdropVariant = "nightly" | "dev";

export function resolveSidebarStageBackdropVariant(
  stageLabel: string,
): SidebarStageBackdropVariant | null {
  const normalized = stageLabel.trim().toLowerCase();
  if (normalized === "nightly") return "nightly";
  if (normalized === "dev") return "dev";
  return null;
}

export function useSidebarStageBackdropVariant(): SidebarStageBackdropVariant | null {
  const primaryServerVersion =
    useAtomValue(primaryServerConfigAtom)?.environment.serverVersion ?? null;

  return resolveSidebarStageBackdropVariant(
    resolveServerBackedAppStageLabel({
      primaryServerVersion,
      fallbackStageLabel: APP_STAGE_LABEL,
    }),
  );
}

/** Stage-channel header art; palettes mirror the per-channel app icons in `assets/`. */
export function SidebarStageBackdrop({ variant }: { variant: SidebarStageBackdropVariant }) {
  return (
    <div
      aria-hidden
      className="sidebar-stage-backdrop pointer-events-none absolute inset-x-0 top-0 z-0 h-20 select-none overflow-hidden"
    >
      {variant === "nightly" ? <NightlySkyArt /> : <DevBlueprintArt />}
    </div>
  );
}

const NIGHTLY_STARS: ReadonlyArray<{
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  delay: number;
}> = [
  { cx: 14, cy: 10, r: 0.6, opacity: 0.85, delay: 0 },
  { cx: 38, cy: 22, r: 0.4, opacity: 0.55, delay: 1.4 },
  { cx: 58, cy: 8, r: 0.5, opacity: 0.7, delay: 2.6 },
  { cx: 84, cy: 16, r: 0.4, opacity: 0.5, delay: 3.6 },
  { cx: 104, cy: 7, r: 0.6, opacity: 0.8, delay: 0.8 },
  { cx: 126, cy: 20, r: 0.4, opacity: 0.55, delay: 4.4 },
  { cx: 148, cy: 11, r: 0.5, opacity: 0.7, delay: 3.2 },
  { cx: 170, cy: 24, r: 0.4, opacity: 0.5, delay: 1.9 },
  { cx: 192, cy: 9, r: 0.6, opacity: 0.8, delay: 5.1 },
  { cx: 214, cy: 18, r: 0.4, opacity: 0.55, delay: 2.2 },
  { cx: 236, cy: 8, r: 0.5, opacity: 0.7, delay: 0.4 },
  { cx: 258, cy: 20, r: 0.45, opacity: 0.6, delay: 3.9 },
  { cx: 278, cy: 11, r: 0.55, opacity: 0.75, delay: 1.1 },
  { cx: 26, cy: 34, r: 0.4, opacity: 0.45, delay: 4.8 },
  { cx: 118, cy: 34, r: 0.4, opacity: 0.45, delay: 2.9 },
  { cx: 202, cy: 32, r: 0.4, opacity: 0.5, delay: 5.6 },
  { cx: 268, cy: 34, r: 0.4, opacity: 0.45, delay: 1.7 },
];

const NIGHTLY_SPARKLES: ReadonlyArray<{ x: number; y: number; delay: number }> = [
  { x: 70, y: 28, delay: 0.6 },
  { x: 160, y: 36, delay: 2.9 },
  { x: 246, y: 26, delay: 1.7 },
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
            fillOpacity={star.opacity}
            style={{ animationDelay: `${star.delay}s` }}
          />
        ))}
      </g>
      <g stroke="#C8D7FF" strokeLinecap="round" strokeOpacity="0.7" strokeWidth="0.6">
        {NIGHTLY_SPARKLES.map((sparkle) => (
          <g
            key={`${sparkle.x}-${sparkle.y}`}
            className="stage-star"
            style={{ animationDelay: `${sparkle.delay}s` }}
          >
            <path d={`M${sparkle.x - 1.5} ${sparkle.y}H${sparkle.x + 1.5}`} />
            <path d={`M${sparkle.x} ${sparkle.y - 1.5}V${sparkle.y + 1.5}`} />
          </g>
        ))}
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

      <g stroke="#DDF7FF" strokeOpacity="0.5" strokeWidth="0.5">
        {Array.from({ length: 36 }, (_, i) => {
          const x = i * 8 + 4;
          return <path key={x} d={`M${x} 0V${i % 4 === 2 ? 4 : 2.5}`} />;
        })}
      </g>

      <g stroke="#DDF7FF" strokeLinecap="round" strokeOpacity="0.6" strokeWidth="0.7">
        <path className="stage-bp-dash" d="M180 64H264" strokeDasharray="5 4" />
        <path d="M180 61V67M264 61V67" />
        <path className="stage-bp-dash" d="M276 10V44" strokeDasharray="4 4" strokeOpacity="0.5" />
        <path d="M273 10H279M273 44H279" strokeOpacity="0.5" />
      </g>

      <g stroke="#DDF7FF" strokeLinecap="round" strokeOpacity="0.55" strokeWidth="0.6">
        <g className="stage-bp-mark">
          <path d="M34 60L38 64M38 60L34 64" />
        </g>
        <g className="stage-bp-mark" style={{ animationDelay: "2.1s" }}>
          <path d="M228 26H234M231 23V29" />
        </g>
        <g className="stage-bp-mark" style={{ animationDelay: "4.3s" }}>
          <path d="M143 51H149M146 48V54" />
        </g>
      </g>

      <g stroke="#DDF7FF" strokeOpacity="0.35" strokeWidth="0.6">
        <circle className="stage-bp-dash" cx="196" cy="38" r="13" strokeDasharray="3.5 4" />
        <path d="M196 33V43M191 38H201" strokeOpacity="0.6" strokeWidth="0.4" />
      </g>
    </svg>
  );
}
