import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WebGPURenderer } from "three/webgpu";
import { RenderPipeline } from "three/webgpu";
import {
  clamp,
  dot,
  float,
  fract,
  max,
  min,
  mix,
  pass,
  rand,
  screenUV,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/examples/jsm/tsl/display/ChromaticAberrationNode.js";
import { useExperienceStore } from "../experience/store";
import { SEAM_CLOSED, seamUniform } from "../interface/seam";
import { organismController } from "../simulation/organismController";

const REDUCED_MOTION_SCALE = 0.18;

/**
 * Full TSL post stack. Its intensity follows organism energy, so a touch wakes
 * the optics instead of switching the scene into a separate visual mode.
 */
export function TslBloom() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);

  const post = useMemo(() => {
    const phase = uniform(0);
    const motionScale = uniform(1);
    const chromaStrength = uniform(0.002);
    const grainIntensity = uniform(0.035);
    // Display-referred grade keeps the void black and restores ocean-blue mids
    // after ACES/bloom compress the raymarched material.
    const blackPoint = uniform(0.03);
    const contrast = uniform(1.1);
    const saturation = uniform(1.34);

    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode();
    const bloomPass = bloom(color, 0.22, 0.38, 0.92);
    // Screen-blend, not raw add: already-bright pixels can't stack a second full
    // bloom pass on top and roll to white under ACES — preserves mid contrast.
    const bloomed = color.add(bloomPass.mul(color.oneMinus()));

    // Inline color grade (pure node composition — no Fn wrapper, which trips the
    // type-checker here). 1) black point re-floors the void, 2) contrast S-curve
    // pivoted LOW (0.35) so it lifts the water body instead of crushing it to
    // black, 3) saturation counters ACES.
    const floored = max(bloomed.sub(blackPoint), vec3(0)).div(
      max(float(1).sub(blackPoint), float(0.001)),
    );
    const contrasted = floored.sub(0.35).mul(contrast).add(0.35);
    const lum = dot(contrasted, vec3(0.2126, 0.7152, 0.0722));
    const saturated = max(mix(vec3(lum), contrasted, saturation), vec3(0));
    // Compress one scalar peak and apply its ratio to every channel. Unlike a
    // per-channel clamp, this preserves cyan/blue ratios when bloom runs hot.
    const peak = max(saturated.r, max(saturated.g, saturated.b));
    const knee = float(0.8);
    const headroom = float(0.2);
    const excess = max(peak.sub(knee), 0);
    const compressedPeak = min(
      peak,
      knee.add(excess.mul(headroom).div(excess.add(headroom))),
    );
    const graded = saturated.mul(compressedPeak.div(max(peak, float(0.0001))));
    const chromed = chromaticAberration(graded, chromaStrength, vec2(0.5, 0.5));
    // FilmNode owns an independent global timer. Rebuild its restrained grain
    // here so post animation follows the same snapshot phase and motion scale.
    const grainPhase = phase.mul(motionScale);
    const grainUv = fract(
      screenUV.add(vec2(grainPhase.mul(0.071), grainPhase.mul(-0.053))),
    );
    const grainNoise = rand(grainUv);
    const chromedNode = chromed as unknown as ReturnType<typeof vec4>;
    const grainLift = chromedNode.rgb.mul(clamp(grainNoise.add(0.1), 0, 1));
    const grainedRgb = mix(
      chromedNode.rgb,
      chromedNode.rgb.add(grainLift),
      grainIntensity.mul(motionScale),
    );
    const grained = vec4(grainedRgb, chromedNode.a);

    // ---- inspection seam ----------------------------------------------------
    // Right of the seam the heatmap must reach the screen as authored. Every
    // stage above this point — bloom, black point, contrast, saturation, the
    // peak compressor, chromatic aberration, grain — is tuned to flatter the
    // orb, and all of it would shift the ramp's colours until step count no
    // longer mapped to anything readable. So that side takes the raw scene
    // texture instead of the graded chain.
    //
    // Parked at SEAM_CLOSED (> 1) the mask is 0 for every on-screen pixel, so
    // the shipped image is bit-for-bit what it was before this landed.
    const seam = uniform(SEAM_CLOSED);
    const seamMask = step(seam, screenUV.x);
    const composited = vec4(mix(grained.rgb, color.rgb, seamMask), grained.a);

    const pipeline = new RenderPipeline(gl);
    pipeline.outputNode = composited;

    return {
      pipeline,
      bloomPass,
      seam,
      phase,
      motionScale,
      chromaStrength,
      grainIntensity,
      blackPoint,
      contrast,
      saturation,
    };
  }, [gl, scene, camera]);
  useEffect(() => () => { post.pipeline.dispose?.(); }, [post]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const snapshot = organismController.snapshot;
    const energy = Math.min(snapshot.energy, 1);
    const resonance = Math.min(snapshot.resonance, 1);

    const { inspecting, seam } = useExperienceStore.getState();
    post.seam.value = seamUniform(inspecting, seam);

    post.phase.value = snapshot.phase;
    post.motionScale.value = reducedMotion ? REDUCED_MOTION_SCALE : 1;
    post.bloomPass.strength.value = 0.14 + energy * 0.16 + resonance * 0.05;
    post.bloomPass.radius.value = 0.26 + energy * 0.12;
    post.bloomPass.threshold.value = 0.9 - energy * 0.045;
    post.chromaStrength.value = 0.0012 + resonance * 0.0014;
    post.grainIntensity.value = 0.018 + energy * 0.012;

    const exposure = 0.5 + energy * 0.045 + resonance * 0.018;
    gl.toneMappingExposure += (exposure - gl.toneMappingExposure) * (1 - Math.exp(-5 * dt));

    const gradeK = 1 - Math.exp(-5 * dt);
    const targetBlack = 0.022;
    const targetContrast = 1.13 + energy * 0.045;
    const targetSat = 1.24 + resonance * 0.05;
    post.blackPoint.value += (targetBlack - post.blackPoint.value) * gradeK;
    post.contrast.value += (targetContrast - post.contrast.value) * gradeK;
    post.saturation.value += (targetSat - post.saturation.value) * gradeK;

    post.pipeline.render();
  }, 1);

  return null;
}
