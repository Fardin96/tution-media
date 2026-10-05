/**
 * A single Gaussian blob, in the 1440×768 coordinate space of
 * `public/assets/hero-bg.png`.
 */
export interface MeshBlob {
  /** Center, in px. */
  cx: number;
  cy: number;
  /** Standard deviation along the blob's own x / y axis, in px. */
  sx: number;
  sy: number;
  /** Clockwise rotation, in degrees. */
  rotate: number;
  /** Any CSS color; resolved at paint time so theme variables work. */
  color: string;
  /** Peak opacity at the center (0–1). */
  opacity: number;
}

export const MESH_VIEWBOX = { width: 1440, height: 768 } as const;

/**
 * Mesh shades (own tokens, not the brand primary), ordered dark to light:
 * deep beams < mid beams < corners < pale wash.
 */
const DEEP = 'var(--color-mesh-deep)';
const MID = 'color-mix(in oklab, var(--color-mesh-deep) 50%, var(--color-mesh-corner))';
const CORNER = 'var(--color-mesh-corner)';
const GLOW = 'var(--color-mesh-glow)';
const tint = (pct: number) =>
  `color-mix(in oklab, var(--color-mesh-corner) ${pct}%, var(--color-neutral-white))`;
const WHITE = 'var(--color-neutral-white)';

/*
 * Geometry is a least-squares fit of `public/assets/hero-bg.png`
 * (RMSE ≈ 1.1 / 255). Hand-tuning positions breaks the match; refit instead.
 * Blobs are split by the edge they belong to so narrow screens can pin each
 * side to its corner. Within a group, later blobs paint on top.
 */

/** Full-width wash across the top. Painted first. */
export const MESH_CENTER: MeshBlob[] = [
  { cx: 719.9, cy: 52.3, sx: 699.2, sy: 249.8, rotate: -0.5, color: tint(10), opacity: 0.481 },
  { cx: 696.0, cy: -82.3, sx: 266.3, sy: 107.4, rotate: -13.0, color: GLOW, opacity: 0.626 },
];

export const MESH_LEFT: MeshBlob[] = [
  { cx: -7.7, cy: 24.0, sx: 150.8, sy: 147.2, rotate: -0.5, color: CORNER, opacity: 0.866 },
  { cx: 235.8, cy: 18.5, sx: 143.6, sy: 100.6, rotate: 28.2, color: DEEP, opacity: 0.784 },
  { cx: 85.7, cy: 176.0, sx: 126.5, sy: 68.0, rotate: 47.4, color: MID, opacity: 0.604 },
  { cx: 354.2, cy: 166.3, sx: 69.1, sy: 129.3, rotate: -32.1, color: DEEP, opacity: 0.246 },
  { cx: 195.9, cy: 290.9, sx: 116.5, sy: 100.5, rotate: 5.7, color: tint(25), opacity: 0.258 },
  { cx: 466.1, cy: 47.4, sx: 88.2, sy: 130.2, rotate: 10.4, color: GLOW, opacity: 0.069 },
];

export const MESH_RIGHT: MeshBlob[] = [
  { cx: 1414.8, cy: 34.1, sx: 178.9, sy: 121.6, rotate: 1.8, color: CORNER, opacity: 0.881 },
  { cx: 1135.1, cy: 36.2, sx: 127.9, sy: 106.9, rotate: -11.7, color: DEEP, opacity: 0.87 },
  { cx: 1276.6, cy: 169.7, sx: 133.7, sy: 73.8, rotate: -41.0, color: MID, opacity: 0.651 },
  { cx: 1139.1, cy: 227.3, sx: 97.7, sy: 138.6, rotate: 35.8, color: WHITE, opacity: 0.291 },
  { cx: 1259.3, cy: 331.3, sx: 130.8, sy: 68.8, rotate: -13.4, color: GLOW, opacity: 0.117 },
  { cx: 1056.0, cy: 83.8, sx: 63.1, sy: 146.2, rotate: 24.7, color: MID, opacity: 0.461 },
];
