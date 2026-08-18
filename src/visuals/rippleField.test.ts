import { describe, expect, it } from "vitest";
import { WAVE_COUNT } from "../simulation/organismController";
import { RIPPLE_SLOTS } from "./rippleField";

describe("RIPPLE_SLOTS / WAVE_COUNT coupling", () => {
  it("keeps the GPU ripple buffer sized to the CPU ring buffer", () => {
    // rippleField's GPU-side uniform arrays are sized to RIPPLE_SLOTS while
    // organismController's CPU-side wave ring buffer is sized to WAVE_COUNT.
    // If these ever drift, WAVE_COUNT > RIPPLE_SLOTS silently drops waves
    // (the extra CPU slots have nowhere to go on the GPU side), so this must
    // stay a hard equality rather than a <=.
    expect(RIPPLE_SLOTS).toBe(WAVE_COUNT);
  });
});
