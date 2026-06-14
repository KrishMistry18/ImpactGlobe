/**
 * gridInterpolator.ts
 *
 * Thin adapter that exposes the two functions the API routes expect:
 *
 *   interpolateToGrid(points)  — runs server-side IDW, returns EnvGrid
 *   gridToJSON(grid)           — identity (grid is already serialisable JSON)
 *
 * The heavy lifting is in gridBaker.ts.
 */

import { bakeGrid } from "./gridBaker";
import type { EnvGrid } from "@/store/types";

interface SparsePoint {
  lat: number;
  lon: number;
  value: number;
}

/**
 * Interpolate sparse points into a dense 360×181 EnvGrid using server-side IDW.
 *
 * ~50ms for 1000 input points on a modern serverless function.
 * The resulting grid is attached to the API response so the browser client
 * can render it with zero client-side interpolation (just GPU bilinear sampling).
 */
export function interpolateToGrid(
  points: SparsePoint[],
  maxDegrees?: number,
): EnvGrid {
  return bakeGrid(points, 6, 2, maxDegrees);
}

/**
 * Serialise an EnvGrid to a plain JSON-safe object.
 * (Already plain — this is an identity function kept for API symmetry.)
 */
export function gridToJSON(grid: EnvGrid): EnvGrid {
  return grid;
}
