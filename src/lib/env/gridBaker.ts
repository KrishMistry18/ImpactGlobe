/**
 * Server-side IDW grid baker
 *
 * Runs on Node (API routes) — never in the browser.
 * Takes sparse data points and produces a dense EnvGrid (360×181 at 1° resolution)
 * using Inverse Distance Weighting in geographic (lat/lon) space.
 *
 * The resulting EnvGrid is attached to the API response alongside the sparse
 * points. The client's renderFromGrid() reads this grid directly with bilinear
 * sampling — zero client-side IDW, no seam artifacts.
 *
 * Grid dimensions:  360 cols × 181 rows
 *   Row 0   = lat +90 (north pole)
 *   Row 180 = lat -90 (south pole)
 *   Col 0   = lon -180, Col 359 = lon +179
 *
 * This matches the UV coordinate system of a Three.js SphereGeometry.
 */

import type { EnvGrid } from '@/store/types'

// 1° resolution grid — 360×181 = 65,160 cells
// Low enough to bake in ~50ms on a serverless function
const GW = 360   // longitude steps: -180 … +179
const GH = 181   // latitude  steps: +90 … -90

/** Generic sparse point */
interface GridPoint {
  lat: number
  lon: number
  value: number
}

/**
 * Bake sparse points into a 360×181 EnvGrid using IDW.
 *
 * @param points   - sparse input data (any density)
 * @param K        - number of nearest neighbours to use (default 6)
 * @param power    - IDW exponent (default 2 — classic inverse-square)
 * @param maxDegrees - ignore points beyond this great-circle distance (default 25°)
 */
export function bakeGrid(
  points: GridPoint[],
  K = 6,
  power = 2,
  maxDegrees = 8,  // influence radius (great-circle degrees). Small on purpose:
                   // cells farther than this from ANY real data stay null
                   // (rendered transparent) instead of being filled with
                   // far-away values. A 60° radius used to smear e.g. freezing
                   // Antarctic readings across the entire empty southern ocean.
): EnvGrid {
  const values: (number | null)[] = new Array(GW * GH).fill(null)
  if (points.length === 0) return { values, width: GW, height: GH, latMin: -90, latMax: 90, lonMin: -180, lonMax: 179 }

  const maxD2 = maxDegrees * maxDegrees
  const KMAX  = Math.min(K, points.length)

  for (let row = 0; row < GH; row++) {
    const lat = 90 - row           // +90 at row 0, -90 at row 180
    const cosLat = Math.cos(lat * Math.PI / 180)

    for (let col = 0; col < GW; col++) {
      const lon = col - 180        // -180 at col 0, +179 at col 359

      const bestD = new Float64Array(KMAX).fill(Infinity)
      const bestV = new Float64Array(KMAX)
      let exactVal: number | null = null

      for (let i = 0; i < points.length; i++) {
        const dlat = lat - points[i].lat

        let dlon = lon - points[i].lon
        if (dlon >  180) dlon -= 360
        if (dlon < -180) dlon += 360

        // cos(lat) correction for longitude
        const ptCos = Math.cos(points[i].lat * Math.PI / 180)
        const dlonC = dlon * (cosLat + ptCos) * 0.5

        const d2 = dlat * dlat + dlonC * dlonC

        // Exact hit
        if (d2 < 0.01) { exactVal = points[i].value; break }

        if (d2 < bestD[KMAX - 1]) {
          bestD[KMAX - 1] = d2
          bestV[KMAX - 1] = points[i].value
          // Insertion sort ascending
          for (let j = KMAX - 1; j > 0 && bestD[j] < bestD[j - 1]; j--) {
            let t = bestD[j]; bestD[j] = bestD[j-1]; bestD[j-1] = t
                t = bestV[j]; bestV[j] = bestV[j-1]; bestV[j-1] = t
          }
        }
      }

      if (exactVal !== null) { values[row * GW + col] = exactVal; continue }
      if (bestD[0] > maxD2)  { values[row * GW + col] = null;     continue }

      let sumW = 0, sumWV = 0
      for (let k = 0; k < KMAX; k++) {
        if (bestD[k] === Infinity) break
        const w = 1 / Math.pow(bestD[k], power / 2)
        sumW  += w
        sumWV += w * bestV[k]
      }
      values[row * GW + col] = sumW > 0 ? sumWV / sumW : null
    }
  }

  return { values, width: GW, height: GH, latMin: -90, latMax: 90, lonMin: -180, lonMax: 179 }
}
