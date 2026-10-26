/**
 * Colour maths for the OKLCH palette.
 *
 * The app names its colours in OKLCH: the CSS side lives in `tailwind.css`,
 * and anything computed from a genre's hue goes through here. The graph
 * renderer and the label overlay need numbers rather than CSS strings, so this
 * module converts, gamut-mapping by reducing chroma until the result fits in
 * sRGB (chroma, unlike HSL saturation, is not equally available at every hue).
 */

/** An sRGB colour, gamma-encoded, channels in 0..1. */
export type Rgb = [number, number, number];

/** OKLab to linear sRGB, via the published Ottosson matrices. */
function oklabToLinearSrgb(L: number, a: number, b: number): Rgb {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

/** Gamma-encode a linear sRGB channel. */
function encodeChannel(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** Decode a gamma-encoded sRGB channel to linear. */
function decodeChannel(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** The tolerance for the gamut test; rounding at the boundary is harmless. */
const GAMUT_EPSILON = 1e-4;

/** OKLCH to sRGB, or null when the colour falls outside sRGB. */
function oklchToSrgbUnclamped(l: number, c: number, h: number): Rgb | null {
  const radians = (h * Math.PI) / 180;
  const linear = oklabToLinearSrgb(
    l,
    c * Math.cos(radians),
    c * Math.sin(radians)
  );
  const rgb: Rgb = [
    encodeChannel(linear[0]),
    encodeChannel(linear[1]),
    encodeChannel(linear[2]),
  ];

  if (
    rgb.some(
      (channel) => channel < -GAMUT_EPSILON || channel > 1 + GAMUT_EPSILON
    )
  ) {
    return null;
  }

  return rgb;
}

/** The most chroma sRGB can hold at a lightness and hue. */
const maxChromaCache = new Map<string, number>();

/**
 * The most chroma sRGB can hold at a lightness and hue. The graph asks for the
 * same pairs thousands of times per frame, so results are cached to a
 * thousandth of a lightness.
 */
export function maxChroma(l: number, h: number): number {
  const key = `${Math.round(l * 1000)}:${Math.round(h)}`;
  const cached = maxChromaCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let low = 0;
  let high = 0.4;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (oklchToSrgbUnclamped(l, mid, h)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  maxChromaCache.set(key, low);
  return low;
}

/** OKLCH to sRGB in 0..1, with chroma reduced until it fits in sRGB. */
export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const fitted = oklchToSrgbUnclamped(l, Math.min(c, maxChroma(l, h)), h);
  return fitted ?? oklchToSrgbUnclamped(l, 0, h) ?? [l, l, l];
}

/** A channel as an 8-bit integer. */
const toByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);

/** OKLCH to a CSS `rgb()`/`rgba()` string. */
export function oklchCss(
  l: number,
  c: number,
  h: number,
  alpha: number = 1
): string {
  const [r, g, b] = oklchToRgb(l, c, h);
  const rgb = `${toByte(r)}, ${toByte(g)}, ${toByte(b)}`;
  return alpha >= 1 ? `rgb(${rgb})` : `rgba(${rgb}, ${alpha})`;
}

/** OKLCH to a CSS hex string, for the few places that can't take `oklch()`. */
export function oklchHex(l: number, c: number, h: number): string {
  const [r, g, b] = oklchToRgb(l, c, h);
  return `#${[r, g, b].map((channel) => toByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance (WCAG) of an sRGB colour in 0..1. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * decodeChannel(r) +
    0.7152 * decodeChannel(g) +
    0.0722 * decodeChannel(b)
  );
}

/** The WCAG contrast ratio between two sRGB colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (lighter + 0.05) / (darker + 0.05);
}
