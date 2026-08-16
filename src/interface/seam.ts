/**
 * Inspection-seam geometry. Pure functions only: no DOM, no React, no uniforms.
 *
 * The seam is a normalised screen-X split. Left of it the orb renders as it
 * ships; right of it the raymarch step-count heatmap shows what each pixel
 * cost. Keeping the arithmetic here means the interaction is unit-tested
 * without a GPU, matching how `contactGesture.ts` is structured.
 */

/** Kept off both edges so a fully-dragged seam never hides its own handle. */
export const SEAM_MIN = 0.04;
export const SEAM_MAX = 0.96;

/** Where the seam parks when inspection is off: beyond the right edge, so the
 * shader's `step(seam, screenUV.x)` mask is 0 for every pixel on screen. */
export const SEAM_CLOSED = 1.2;

/** Default opening position — just past centre, so both sides read at a glance. */
export const SEAM_DEFAULT = 0.5;

/** Arrow-key increment. Coarse enough to cross the orb in a few presses. */
export const SEAM_KEY_STEP = 0.02;
/** Shift+arrow, for crossing the screen quickly. */
export const SEAM_KEY_STEP_COARSE = 0.1;

export const clampSeam = (value: number): number => {
  if (!Number.isFinite(value)) return SEAM_DEFAULT;
  return Math.min(SEAM_MAX, Math.max(SEAM_MIN, value));
};

/** Pointer X in client pixels → normalised seam position. */
export const seamFromPointer = (clientX: number, width: number): number => {
  if (!Number.isFinite(width) || width <= 0) return SEAM_DEFAULT;
  return clampSeam(clientX / width);
};

/**
 * Keyboard handling for the seam handle. Returns the next position, or `null`
 * if the key is not one the seam consumes — so the caller knows whether to
 * preventDefault.
 */
export const seamFromKey = (
  current: number,
  key: string,
  shift = false,
): number | null => {
  const stepSize = shift ? SEAM_KEY_STEP_COARSE : SEAM_KEY_STEP;
  switch (key) {
    case "ArrowLeft":
      return clampSeam(current - stepSize);
    case "ArrowRight":
      return clampSeam(current + stepSize);
    case "Home":
      return SEAM_MIN;
    case "End":
      return SEAM_MAX;
    default:
      return null;
  }
};

/** The value handed to the shader uniform for a given UI state. */
export const seamUniform = (active: boolean, position: number): number =>
  active ? clampSeam(position) : SEAM_CLOSED;
