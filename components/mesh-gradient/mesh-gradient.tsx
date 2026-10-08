import { cn } from "@/lib/utils";
import {
  MESH_CENTER,
  MESH_LEFT,
  MESH_RIGHT,
  MESH_VIEWBOX,
  type MeshBlob,
} from "./mesh-gradient.config";
import { AnimatedMeshGradientLayer } from "./mesh-gradient-animated";

export interface MeshGradientProps {
  /** Content rendered above the gradient. */
  children?: React.ReactNode;
  /** Additional classes for the outer wrapper. */
  className?: string;
  /** Slow drift animation. Off when the user prefers reduced motion. */
  animated?: boolean;
  /** Wrapper element tag; defaults to "section". */
  as?: React.ElementType;
}

/** Each blob is drawn out to this many standard deviations (alpha < 0.3%). */
const SIGMAS = 3.5;
/** Opacity multiplier; 1.1 measured closest to hero-bg.png (RMSE 2.88 vs 3.11 at 1.0). */
const STRENGTH = 1.1;
const STOPS = Array.from({ length: 15 }, (_, i) => i / 14);
const HALF = MESH_VIEWBOX.width / 2;

/**
 * Hero background that reproduces `public/assets/hero-bg.png` as vector
 * Gaussian blobs in the primary palette.
 *
 * At ≥ 640px wide it is the reference, scaled to the section width. Below
 * that the composition stops shrinking, and the left and right halves stay
 * pinned to their corners and overlap in the middle, so phones still get
 * both corner beams.
 */
export function MeshGradient({
  children,
  className,
  animated = false,
  as: Tag = "section",
}: MeshGradientProps) {
  const layers = (
    <>
      <BlobLayer
        id="center"
        blobs={MESH_CENTER}
        viewBoxX={0}
        width={MESH_VIEWBOX.width}
        className="left-1/2 w-[max(100%,640px)] -translate-x-1/2"
      />
      <BlobLayer
        id="left"
        blobs={MESH_LEFT}
        viewBoxX={0}
        width={HALF}
        className="left-0 w-[max(50%,320px)]"
      />
      <BlobLayer
        id="right"
        blobs={MESH_RIGHT}
        viewBoxX={HALF}
        width={HALF}
        className="right-0 w-[max(50%,320px)]"
      />
    </>
  );

  return (
    <Tag className={cn("relative isolate overflow-hidden", className)}>
      {animated ? (
        <AnimatedMeshGradientLayer>{layers}</AnimatedMeshGradientLayer>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          {layers}
        </div>
      )}
      {children}
    </Tag>
  );
}

interface BlobLayerProps {
  id: string;
  blobs: MeshBlob[];
  /** Left edge of this layer's slice of the 1440-wide reference. */
  viewBoxX: number;
  width: number;
  className: string;
}

/** One slice of the reference; blobs may paint past its edges. */
function BlobLayer({ id, blobs, viewBoxX, width, className }: BlobLayerProps) {
  return (
    <svg
      className={cn("absolute top-0 h-auto overflow-visible", className)}
      viewBox={`${viewBoxX} 0 ${width} ${MESH_VIEWBOX.height}`}
    >
      <defs>
        {blobs.map((blob, i) => (
          <radialGradient key={i} id={`mesh-${id}-${i}`}>
            {STOPS.map((t) => (
              <stop
                key={t}
                offset={t}
                // `style`, not the attribute: only CSS resolves var()/color-mix.
                style={{ stopColor: blob.color }}
                stopOpacity={
                  Math.min(1, blob.opacity * STRENGTH) *
                  Math.exp(-0.5 * (SIGMAS * t) ** 2)
                }
              />
            ))}
          </radialGradient>
        ))}
      </defs>
      {blobs.map((blob, i) => (
        <ellipse
          key={i}
          cx={blob.cx}
          cy={blob.cy}
          rx={blob.sx * SIGMAS}
          ry={blob.sy * SIGMAS}
          transform={`rotate(${blob.rotate} ${blob.cx} ${blob.cy})`}
          fill={`url(#mesh-${id}-${i})`}
        />
      ))}
    </svg>
  );
}
