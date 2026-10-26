"use client";
/* Signed, pre-sized artwork is served directly. */
/* This focusable image region supports keyboard, pointer and touch exploration. */
/* eslint-disable @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */
import { useEffect, useId, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

type View = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
const fitted: View = { scale: 1, x: 0, y: 0 };

export const ZoomableArtwork = ({ src, alt }: { src: string; alt: string }) => {
  const helpId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const current = useRef<View>(fitted);
  const pointers = useRef(new Map<number, Point>());
  const [view, setView] = useState<View>(fitted);
  const [dragging, setDragging] = useState(false);
  const update = (next: View) => {
    const box = viewport.current;
    const img = image.current;
    const scale = Math.min(5, Math.max(1, next.scale));
    const fit =
      box && img?.naturalWidth
        ? Math.min(
            box.clientWidth / img.naturalWidth,
            box.clientHeight / img.naturalHeight,
          )
        : 0;
    const maxX =
      box && img
        ? Math.max(0, (img.naturalWidth * fit * scale - box.clientWidth) / 2)
        : 0;
    const maxY =
      box && img
        ? Math.max(0, (img.naturalHeight * fit * scale - box.clientHeight) / 2)
        : 0;
    current.current = {
      scale,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
    setView(current.current);
  };
  const zoom = (scale: number, anchor: Point = { x: 0, y: 0 }) => {
    const before = current.current;
    const clamped = Math.max(1, Math.min(5, scale));
    const ratio = clamped / before.scale;
    update({
      scale: clamped,
      x: anchor.x - (anchor.x - before.x) * ratio,
      y: anchor.y - (anchor.y - before.y) * ratio,
    });
  };
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const observer = new ResizeObserver(() => update(current.current));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const local = (point: Point) => {
    const rect = viewport.current?.getBoundingClientRect();
    return rect
      ? {
          x: point.x - rect.left - rect.width / 2,
          y: point.y - rect.top - rect.height / 2,
        }
      : { x: 0, y: 0 };
  };
  return (
    <div className="art-zoom">
      <div
        ref={viewport}
        className="art-zoom-viewport"
        data-zoomed={view.scale > 1}
        data-dragging={dragging}
        tabIndex={0}
        role="region"
        aria-label="Zoomable artwork"
        aria-describedby={helpId}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=")
            zoom(current.current.scale * 1.5);
          else if (event.key === "-") zoom(current.current.scale / 1.5);
          else if (event.key === "0" || event.key === "Escape") {
            if (current.current.scale === 1) return;
            update(fitted);
          } else if (
            event.key.startsWith("Arrow") &&
            current.current.scale > 1
          ) {
            const { x, y, scale } = current.current;
            update({
              scale,
              x:
                x +
                (event.key === "ArrowLeft"
                  ? 60
                  : event.key === "ArrowRight"
                    ? -60
                    : 0),
              y:
                y +
                (event.key === "ArrowUp"
                  ? 60
                  : event.key === "ArrowDown"
                    ? -60
                    : 0),
            });
          } else return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDoubleClick={(event) =>
          zoom(
            current.current.scale > 1 ? 1 : 2.5,
            local({ x: event.clientX, y: event.clientY }),
          )
        }
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const other = [...pointers.current.entries()].find(
            ([id]) => id !== event.pointerId,
          )?.[1];
          const point = { x: event.clientX, y: event.clientY };
          if (other) {
            const oldDistance = Math.hypot(
              previous.x - other.x,
              previous.y - other.y,
            );
            const distance = Math.hypot(point.x - other.x, point.y - other.y);
            if (oldDistance > 0)
              zoom(
                (current.current.scale * distance) / oldDistance,
                local({
                  x: (point.x + other.x) / 2,
                  y: (point.y + other.y) / 2,
                }),
              );
          } else if (current.current.scale > 1) {
            update({
              ...current.current,
              x: current.current.x + point.x - previous.x,
              y: current.current.y + point.y - previous.y,
            });
          }
          pointers.current.set(event.pointerId, point);
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          setDragging(pointers.current.size > 0);
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          setDragging(pointers.current.size > 0);
        }}
        onLostPointerCapture={(event) => {
          pointers.current.delete(event.pointerId);
          setDragging(pointers.current.size > 0);
        }}
      >
        <img
          ref={image}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => update(current.current)}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        />
      </div>
      <div
        className="art-zoom-toolbar"
        role="group"
        aria-label="Image zoom controls"
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={view.scale === 1}
          onClick={() => zoom(current.current.scale / 1.5)}
        >
          <Minus size={17} />
        </button>
        <span aria-live="polite" aria-atomic="true">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={view.scale === 5}
          onClick={() => zoom(current.current.scale * 1.5)}
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          aria-label="Fit image"
          disabled={view.scale === 1}
          onClick={() => update(fitted)}
        >
          <Maximize size={17} />
        </button>
      </div>
      <p id={helpId} className="art-zoom-help">
        Double-click or pinch to zoom · Drag to explore
      </p>
    </div>
  );
};
