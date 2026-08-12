import { useEffect, useRef, useState } from "react";
import { organismController } from "../simulation/organismController";
import { useExperienceStore } from "../experience/store";

const SOURCE_URL = "https://github.com/boydcroberts/Lattice-Tension";

export function InterfaceOverlay() {
  const ready = useExperienceStore((state) => state.ready);
  const audioEnabled = useExperienceStore((state) => state.audioEnabled);
  const setAudioEnabled = useExperienceStore((state) => state.setAudioEnabled);
  const [announcement, setAnnouncement] = useState(
    "Aesther is ready. Press Enter or Space to touch the center, or use arrow keys to send a gentle impulse.",
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutToggleRef = useRef<HTMLButtonElement>(null);
  const aboutCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aboutOpen) aboutCloseRef.current?.focus();
  }, [aboutOpen]);

  const closeAbout = () => {
    setAboutOpen(false);
    aboutToggleRef.current?.focus();
  };

  const sendKeyboardImpulse = (direction: [number, number], message: string) => {
    organismController.pulseFromKeyboard(direction);
    setAnnouncement(message);
  };

  return (
    <div className="interface" data-aesther-ui>
      <div className="atmosphere" aria-hidden="true" />

      <header className="brand">
        <h1 className="brand__mark">AESTHER</h1>
      </header>

      <div className="hud-controls">
        <button
          ref={aboutToggleRef}
          className="about-control"
          type="button"
          aria-expanded={aboutOpen}
          aria-controls="about-panel"
          aria-label={aboutOpen ? "Close about panel" : "About this piece"}
          onClick={() => setAboutOpen((open) => !open)}
        >
          <span className="about-control__label">About</span>
          <span className="about-control__glyph" aria-hidden="true">
            i
          </span>
        </button>

        <button
          className="sound-control"
          type="button"
          aria-pressed={audioEnabled}
          aria-label={audioEnabled ? "Mute Aesther" : "Enable Aesther sound"}
          onClick={() => setAudioEnabled(!audioEnabled)}
        >
          <span className="sound-control__label">
            {audioEnabled ? "Sound on" : "Sound off"}
          </span>
          <span className="sound-control__bars" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <i key={index} />
            ))}
          </span>
        </button>
      </div>

      {aboutOpen ? (
        <div
          id="about-panel"
          className="about-panel"
          role="dialog"
          aria-modal="true"
          aria-label="About Aesther"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeAbout();
          }}
        >
          <p className="about-panel__body">
            A living glass organism — a custom raymarched WebGPU shader paired
            with a real-time modal physics engine: spring-mass shell,
            multi-touch contact aggregation, non-Newtonian shear response, all
            driven by one fixed-step controller. Built solo by Boyd Roberts.
          </p>
          <div className="about-panel__row">
            <a
              className="about-panel__link"
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source ↗
            </a>
            <button
              ref={aboutCloseRef}
              className="about-panel__close"
              type="button"
              onClick={closeAbout}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <button
        className="organism-accessibility-target"
        type="button"
        aria-label="Interact with Aesther. Press Enter or Space for a center touch. Arrow keys send directional impulses."
        onClick={() => sendKeyboardImpulse([0, 0], "Aesther ripples from the center.")}
        onKeyDown={(event) => {
          const impulses: Record<string, [number, number]> = {
            ArrowUp: [0, 0.78],
            ArrowDown: [0, -0.78],
            ArrowLeft: [-0.78, 0],
            ArrowRight: [0.78, 0],
          };
          const direction = impulses[event.key];
          if (!direction) return;
          event.preventDefault();
          sendKeyboardImpulse(direction, "Aesther receives a directional impulse.");
        }}
      >
        Touch Aesther
      </button>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div className={`loading-screen ${ready ? "is-ready" : ""}`} role="status">
        <div className="loading-screen__signal" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p>{ready ? "Aesther is awake" : "Forming Aesther"}</p>
      </div>
    </div>
  );
}
