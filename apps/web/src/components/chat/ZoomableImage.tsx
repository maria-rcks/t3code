import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

const MAX_ZOOM = 8;

/** Keeps zoomed pixels in a native scroll area so wheels and touch can explore the whole image. */
export function ZoomableImage({
  src,
  name,
  onError,
}: {
  src: string;
  name: string;
  onError: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [windowSize, setWindowSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const anchorRef = useRef<{ x: number; y: number; viewportX: number; viewportY: number } | null>(
    null,
  );
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const maxHeight = Math.max(1, Math.min(windowSize.height * 0.8, windowSize.height - 120));
  const fit = Math.min(
    1,
    (windowSize.width * 0.92) / (naturalSize.width || 1),
    maxHeight / (naturalSize.height || 1),
  );
  const width = naturalSize.width * fit * zoom;
  const height = naturalSize.height * fit * zoom;

  const changeZoom = useCallback((next: number, point?: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    const previous = zoomRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!viewport || previous === clamped) return;
    const bounds = viewport.getBoundingClientRect();
    const x = point ? point.x - bounds.left : viewport.clientWidth / 2;
    const y = point ? point.y - bounds.top : viewport.clientHeight / 2;
    anchorRef.current = {
      x: (viewport.scrollLeft + x) / previous,
      y: (viewport.scrollTop + y) / previous,
      viewportX: x / viewport.clientWidth,
      viewportY: y / viewport.clientHeight,
    };
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    if (!viewport || !anchor) return;
    viewport.scrollLeft = anchor.x * zoom - anchor.viewportX * viewport.clientWidth;
    viewport.scrollTop = anchor.y * zoom - anchor.viewportY * viewport.clientHeight;
    anchorRef.current = null;
  }, [zoom]);

  useEffect(() => {
    const resize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      changeZoom(1);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [changeZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      changeZoom(zoomRef.current * Math.exp(-delta * 0.01), {
        x: event.clientX,
        y: event.clientY,
      });
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [changeZoom]);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        ref={viewportRef}
        role="region"
        aria-label={`${name}, zoomable image`}
        tabIndex={0}
        className="max-w-[92vw] overflow-auto overscroll-contain rounded-lg bg-background shadow-2xl ring-1 ring-border/70 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          width: width || undefined,
          height: height || undefined,
          maxHeight,
          cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
        }}
        onDoubleClick={(event) => {
          changeZoom(zoomRef.current > 1 ? 1 : 2, { x: event.clientX, y: event.clientY });
        }}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            changeZoom(zoomRef.current * 1.5);
          } else if (event.key === "-") {
            event.preventDefault();
            changeZoom(zoomRef.current / 1.5);
          } else if (event.key === "0") {
            event.preventDefault();
            changeZoom(1);
          } else if (zoomRef.current > 1 && event.key.startsWith("Arrow")) {
            // Leave native keyboard scrolling enabled without navigating the gallery.
            event.stopPropagation();
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || zoomRef.current <= 1) return;
          const viewport = event.currentTarget;
          const bounds = viewport.getBoundingClientRect();
          if (
            event.clientX - bounds.left >= viewport.clientWidth ||
            event.clientY - bounds.top >= viewport.clientHeight
          )
            return;
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            left: viewport.scrollLeft,
            top: viewport.scrollTop,
          };
          viewport.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x);
          event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          dragRef.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <img
          src={src}
          alt={name}
          draggable={false}
          className="block max-w-none select-none"
          style={naturalSize.width ? { width, height } : { maxWidth: "92vw", maxHeight }}
          onLoad={(event) => {
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
          onError={onError}
        />
      </div>
      <div
        role="group"
        aria-label="Image zoom"
        className="flex items-center gap-1 rounded-full bg-black/70 p-1 text-white"
      >
        <Button
          size="icon-xs"
          variant="overlay"
          aria-label="Zoom out"
          disabled={zoom <= 1 || !naturalSize.width}
          onClick={() => changeZoom(zoomRef.current / 1.5)}
        >
          <MinusIcon />
        </Button>
        <span className="min-w-12 text-center text-xs tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="icon-xs"
          variant="overlay"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM || !naturalSize.width}
          onClick={() => changeZoom(zoomRef.current * 1.5)}
        >
          <PlusIcon />
        </Button>
        <Button
          size="icon-xs"
          variant="overlay"
          aria-label="Reset zoom to fit"
          disabled={zoom <= 1}
          onClick={() => changeZoom(1)}
        >
          <RotateCcwIcon />
        </Button>
      </div>
    </div>
  );
}
