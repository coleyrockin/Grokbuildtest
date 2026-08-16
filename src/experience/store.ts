import { create } from "zustand";
import type { PerformanceProfile } from "../performance/profile";
import { SEAM_DEFAULT, clampSeam } from "../interface/seam";

/**
 * React state is deliberately reserved for application-level state. The living
 * organism runs outside React at 120 Hz in `OrganismController`.
 */
type ExperienceStore = {
  ready: boolean;
  audioEnabled: boolean;
  reducedMotion: boolean;
  profile: PerformanceProfile | null;
  renderError: boolean;
  /** Inspection seam: whether the split is open, and where it sits (0..1). */
  inspecting: boolean;
  seam: number;
  setReady: (ready: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setProfile: (profile: PerformanceProfile) => void;
  setRenderError: (failed: boolean) => void;
  setInspecting: (inspecting: boolean) => void;
  setSeam: (seam: number) => void;
};

export const useExperienceStore = create<ExperienceStore>((set) => ({
  ready: false,
  audioEnabled: false,
  reducedMotion: false,
  profile: null,
  renderError: false,
  inspecting: false,
  seam: SEAM_DEFAULT,
  setReady: (ready) => set({ ready }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setProfile: (profile) => set({ profile }),
  setRenderError: (renderError) => set({ renderError }),
  setInspecting: (inspecting) => set({ inspecting }),
  setSeam: (seam) => set({ seam: clampSeam(seam) }),
}));
