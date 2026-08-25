// Six meridians, phase-offset by 1/6 of the cycle, read as one rotating sphere.
// Adapted from the aicss.dev web-search treatment.
const MERIDIANS = {
  L: "M6.057 11.565 C2.081 11.565 0.371 8.159 0.371 5.964 C0.371 3.642 2.152 0.329 6.05 0.329",
  ML: "M6.012 11.55 C4.575 10.496 3.333 8.116 3.321 5.964 C3.307 3.399 4.974 0.977 6.012 0.329",
  MR: "M6.012 11.55 C7.211 10.781 8.715 8.287 8.715 5.964 C8.715 3.399 7.24 1.233 6.012 0.329",
  R: "M6.012 11.55 C9.677 11.55 11.65 8.487 11.65 5.964 C11.65 3.499 9.748 0.329 6.012 0.329",
} as const;

const PHASES = ["0s", "-1.2s", "-2.4s", "-3.6s", "-4.8s", "-6s"];

/**
 * Rotating wireframe globe used as the "fetching" state of a result row.
 *
 * Animated with SMIL rather than CSS because each meridian morphs along a path
 * (`attributeName="d"`), which CSS cannot interpolate. SMIL animation is
 * unaffected by `prefers-reduced-motion`, so callers should swap this out
 * entirely under that query rather than relying on it to settle.
 */
export function GlobeSpinner({ size = 12 }: { size?: number }) {
  const values = [MERIDIANS.L, MERIDIANS.ML, MERIDIANS.MR, MERIDIANS.R, MERIDIANS.L].join(";");

  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.85"
      strokeLinecap="round"
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <circle cx="6" cy="6" r="5.7" opacity="0.9" />
      <line x1="0.3" y1="6" x2="11.7" y2="6" opacity="0.9" />
      {PHASES.map((begin) => (
        <path key={begin} d={MERIDIANS.L} opacity="0">
          <animate
            attributeName="d"
            dur="7.2s"
            begin={begin}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.25;0.5;0.75;1"
            keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            values={values}
          />
          {/* Fades each meridian out as it reaches the sphere's edge. */}
          <animate
            attributeName="opacity"
            dur="7.2s"
            begin={begin}
            repeatCount="indefinite"
            calcMode="linear"
            keyTimes="0;0.05;0.7;0.75;1"
            values="0;0.9;0.9;0;0"
          />
        </path>
      ))}
    </svg>
  );
}
