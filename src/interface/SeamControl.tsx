import { useCallback, useEffect, useRef } from "react";
import { useExperienceStore } from "../experience/store";
import { seamFromKey, seamFromPointer } from "./seam";

/**
 * The inspection seam: a draggable split between the finished orb and the
 * raymarch step-count heatmap of the same frame.
 *
 * All geometry lives in `seam.ts` and is unit-tested there. This component only
 * turns events into positions and owns the DOM affordance — the divider line,
 * the grab handle, and the ramp legend that makes the heatmap readable.
 */
export function SeamControl() {
  const inspecting = useExperienceStore((state) => state.inspecting);
  const seam = useExperienceStore((state) => state.seam);
  const setInspecting = useExperienceStore((state) => state.setInspecting);
  const setSeam = useExperienceStore((state) => state.setSeam);

  const handleRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  // Moving focus to the handle on open is what makes this discoverable by
  // keyboard: the seam is useless if the only way to move it is a mouse.
  useEffect(() => {
    if (inspecting) handleRef.current?.focus();
  }, [inspecting]);

  const close = useCallback(() => {
    setInspecting(false);
    toggleRef.current?.focus();
  }, [setInspecting]);

  const track = useCallback(
    (clientX: number) => setSeam(seamFromPointer(clientX, window.innerWidth)),
    [setSeam],
  );

  return (
    <>
      <button
        ref={toggleRef}
        className={`seam-toggle ${inspecting ? "is-active" : ""}`}
        type="button"
        aria-pressed={inspecting}
        aria-label={
          inspecting
            ? "Close the inspection seam"
            : "Inspect the renderer: split the view to show raymarch cost per pixel"
        }
        onClick={() => (inspecting ? close() : setInspecting(true))}
      >
        <span className="seam-toggle__label">
          {inspecting ? "Close" : "Inspect"}
        </span>
        <span className="seam-toggle__glyph" aria-hidden="true" />
      </button>

      {inspecting ? (
        <div className="seam" style={{ "--seam": seam } as React.CSSProperties}>
          <div className="seam__line" aria-hidden="true" />

          <div
            ref={handleRef}
            className="seam__handle"
            role="slider"
            tabIndex={0}
            aria-label="Inspection seam position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(seam * 100)}
            aria-valuetext={`Seam at ${Math.round(seam * 100)} percent. Left of the seam is the rendered orb, right is raymarch cost per pixel.`}
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              track(event.clientX);
            }}
            onPointerMove={(event) => {
              if (dragging.current) track(event.clientX);
            }}
            onPointerUp={(event) => {
              dragging.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
                return;
              }
              const next = seamFromKey(seam, event.key, event.shiftKey);
              if (next === null) return;
              event.preventDefault();
              setSeam(next);
            }}
          >
            <span className="seam__grip" aria-hidden="true" />
          </div>

          {/* Without this the heatmap is just pretty colours. With it, a viewer
              knows they are looking at cost, and which end is which. */}
          <div className="seam__legend" aria-hidden="true">
            <span className="seam__legend-title">raymarch steps / pixel</span>
            <span className="seam__legend-ramp" />
            <span className="seam__legend-scale">
              <span>cheap</span>
              <span>expensive</span>
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
