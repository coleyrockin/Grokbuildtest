import { describe, expect, it } from "vitest";
import {
  SEAM_CLOSED,
  SEAM_DEFAULT,
  SEAM_KEY_STEP,
  SEAM_KEY_STEP_COARSE,
  SEAM_MAX,
  SEAM_MIN,
  clampSeam,
  seamFromKey,
  seamFromPointer,
  seamUniform,
} from "./seam";

describe("clampSeam", () => {
  it("keeps the seam off both edges so the handle stays reachable", () => {
    expect(clampSeam(-3)).toBe(SEAM_MIN);
    expect(clampSeam(9)).toBe(SEAM_MAX);
  });

  it("passes interior values through untouched", () => {
    expect(clampSeam(0.5)).toBe(0.5);
  });

  it("falls back to centre rather than propagating NaN into a uniform", () => {
    expect(clampSeam(Number.NaN)).toBe(SEAM_DEFAULT);
    expect(clampSeam(Number.POSITIVE_INFINITY)).toBe(SEAM_DEFAULT);
  });
});

describe("seamFromPointer", () => {
  it("maps pointer x across the viewport width", () => {
    expect(seamFromPointer(320, 1280)).toBeCloseTo(0.25);
    expect(seamFromPointer(640, 1280)).toBeCloseTo(0.5);
  });

  it("clamps a drag past either edge", () => {
    expect(seamFromPointer(-50, 1280)).toBe(SEAM_MIN);
    expect(seamFromPointer(5000, 1280)).toBe(SEAM_MAX);
  });

  it("survives a zero-width measurement during layout", () => {
    expect(seamFromPointer(100, 0)).toBe(SEAM_DEFAULT);
  });
});

describe("seamFromKey", () => {
  it("steps left and right", () => {
    expect(seamFromKey(0.5, "ArrowRight")).toBeCloseTo(0.5 + SEAM_KEY_STEP);
    expect(seamFromKey(0.5, "ArrowLeft")).toBeCloseTo(0.5 - SEAM_KEY_STEP);
  });

  it("uses a coarse step with shift held", () => {
    expect(seamFromKey(0.5, "ArrowRight", true)).toBeCloseTo(
      0.5 + SEAM_KEY_STEP_COARSE,
    );
  });

  it("jumps to the edges on Home and End", () => {
    expect(seamFromKey(0.5, "Home")).toBe(SEAM_MIN);
    expect(seamFromKey(0.5, "End")).toBe(SEAM_MAX);
  });

  it("clamps rather than running off the edge", () => {
    expect(seamFromKey(SEAM_MAX, "ArrowRight")).toBe(SEAM_MAX);
    expect(seamFromKey(SEAM_MIN, "ArrowLeft")).toBe(SEAM_MIN);
  });

  it("returns null for keys it does not consume", () => {
    expect(seamFromKey(0.5, "Tab")).toBeNull();
    expect(seamFromKey(0.5, "a")).toBeNull();
  });
});

describe("seamUniform", () => {
  it("parks off-screen when inspection is off, so the shader mask is zero", () => {
    expect(seamUniform(false, 0.5)).toBe(SEAM_CLOSED);
    expect(SEAM_CLOSED).toBeGreaterThan(1);
  });

  it("reports the clamped position when inspection is on", () => {
    expect(seamUniform(true, 0.42)).toBeCloseTo(0.42);
    expect(seamUniform(true, 99)).toBe(SEAM_MAX);
  });
});
