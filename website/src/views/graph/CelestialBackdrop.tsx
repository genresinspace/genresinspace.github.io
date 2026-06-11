/**
 * A quiet celestial-cartography atmosphere drawn over the (opaque) WebGL
 * canvas but under the labels and UI: a faint right-ascension/declination
 * graticule and a sparse, dim starfield. Pure SVG, pointer-events: none,
 * and deliberately whisper-quiet so it never competes with the data.
 */

const GRATICULE_STROKE = "rgba(143, 208, 224, 0.08)";
const GRATICULE_STROKE_FAINT = "rgba(143, 208, 224, 0.045)";
const ECLIPTIC_STROKE = "rgba(201, 168, 106, 0.11)";

/** Deterministic PRNG so the starfield is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS: { x: number; y: number; r: number; o: number }[] = (() => {
  const rand = mulberry32(1781); // Bode's Uranographia, 1801 — minus 20
  const stars = [];
  for (let i = 0; i < 110; i++) {
    stars.push({
      x: Math.round(rand() * 1000),
      y: Math.round(rand() * 1000),
      r: 0.4 + rand() * 0.8,
      o: 0.08 + rand() * 0.22,
    });
  }
  return stars;
})();

// Centre of the chart, nudged above the geometric centre like a planisphere
const CX = 500;
const CY = 430;
const DECLINATION_RINGS = [110, 220, 330, 440, 560, 690, 830];
const SPOKE_COUNT = 24; // every 15 degrees of right ascension

/** The graticule + starfield overlay for the graph viewport. */
export function CelestialBackdrop() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Sparse dim starfield */}
      {STARS.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#cfe2ec"
          opacity={s.o}
        />
      ))}

      {/* Declination rings */}
      {DECLINATION_RINGS.map((r, i) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke={i % 2 === 0 ? GRATICULE_STROKE : GRATICULE_STROKE_FAINT}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Right-ascension spokes */}
      {Array.from({ length: SPOKE_COUNT }, (_, i) => {
        const angle = (i * 2 * Math.PI) / SPOKE_COUNT;
        const inner = 110;
        const outer = 1400;
        return (
          <line
            key={i}
            x1={CX + Math.cos(angle) * inner}
            y1={CY + Math.sin(angle) * inner}
            x2={CX + Math.cos(angle) * outer}
            y2={CY + Math.sin(angle) * outer}
            stroke={i % 6 === 0 ? GRATICULE_STROKE : GRATICULE_STROKE_FAINT}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {/* The ecliptic: one brass great-circle arc, dashed, slightly off-axis */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={780}
        ry={560}
        fill="none"
        stroke={ECLIPTIC_STROKE}
        strokeDasharray="6 10"
        vectorEffect="non-scaling-stroke"
        transform={`rotate(-18 ${CX} ${CY})`}
      />
    </svg>
  );
}
