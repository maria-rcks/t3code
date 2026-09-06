import { cn } from "../../lib/utils";
import { useClientSettings } from "../../hooks/useSettings";

export function TimelineBackgroundImage({
  image,
  opacity,
  blur,
  className,
}: {
  image: string;
  opacity: number;
  blur: number;
  className?: string | undefined;
}) {
  if (!image) return null;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <img
        src={image}
        alt=""
        draggable={false}
        className="absolute size-full object-cover"
        style={{
          inset: -blur * 2,
          width: `calc(100% + ${blur * 4}px)`,
          height: `calc(100% + ${blur * 4}px)`,
          opacity: opacity / 100,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      />
    </div>
  );
}

export function ChatTimelineBackground({ className }: { className?: string | undefined }) {
  const image = useClientSettings((settings) => settings.timelineBackgroundImage);
  const opacity = useClientSettings((settings) => settings.timelineBackgroundOpacity);
  const blur = useClientSettings((settings) => settings.timelineBackgroundBlur);
  return (
    <TimelineBackgroundImage image={image} opacity={opacity} blur={blur} className={className} />
  );
}
