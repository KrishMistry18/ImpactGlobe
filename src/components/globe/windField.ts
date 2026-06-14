/**
 * Wind vector field + particle simulation for Windy-style animated streamlines.
 *
 * The server wind grid only stores SPEED, so we reconstruct a u/v vector field
 * from the sparse wind points (which carry speed + meteorological direction)
 * onto a regular lat/lon grid, fill gaps, and bilinearly sample it.
 *
 * Particles advect through the field in lat/lon space and keep a short position
 * history; each renderer (2D Leaflet / 3D equirect canvas) projects that history
 * to its own coordinate space and draws a fading polyline. Keeping the motion in
 * geographic space means the same simulation drives both views.
 */

export interface WindPointLite {
  lat: number;
  lon: number;
  speed: number; // m/s
  direction: number; // meteorological degrees the wind blows FROM
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const STEP = 2; // working grid resolution (degrees)
const GW = Math.round(360 / STEP); // 180 cols (lon wraps)
const GH = Math.round(180 / STEP) + 1; // 91 rows

export class WindField {
  private u: Float32Array;
  private v: Float32Array;
  maxSpeed = 1;

  constructor(points: WindPointLite[]) {
    const u = new Float32Array(GW * GH).fill(NaN);
    const v = new Float32Array(GW * GH).fill(NaN);

    for (const p of points) {
      const dir = ((p.direction ?? 0) * Math.PI) / 180;
      // Meteorological "from" direction → velocity vector blowing toward:
      //   u = eastward, v = northward
      const uu = -p.speed * Math.sin(dir);
      const vv = -p.speed * Math.cos(dir);
      let c = Math.round((p.lon + 180) / STEP);
      c = ((c % GW) + GW) % GW;
      const r = Math.max(0, Math.min(GH - 1, Math.round((90 - p.lat) / STEP)));
      u[r * GW + c] = uu;
      v[r * GW + c] = vv;
      if (p.speed > this.maxSpeed) this.maxSpeed = p.speed;
    }

    fillHoles(u);
    fillHoles(v);
    this.u = u;
    this.v = v;
  }

  /** Bilinear sample of the vector field (lon wraps). null if no data. */
  sample(lat: number, lon: number): { u: number; v: number } | null {
    const fc = (lon + 180) / STEP;
    const fr = (90 - lat) / STEP;
    let r0 = Math.floor(fr);
    const ty = fr - r0;
    r0 = Math.max(0, Math.min(GH - 2, r0));
    const r1 = r0 + 1;
    const c0 = Math.floor(fc);
    const tx = fc - c0;
    const c0w = ((c0 % GW) + GW) % GW;
    const c1w = (c0w + 1) % GW;

    const U = this.u;
    const V = this.v;
    const u = lerp(
      lerp(U[r0 * GW + c0w], U[r0 * GW + c1w], tx),
      lerp(U[r1 * GW + c0w], U[r1 * GW + c1w], tx),
      ty,
    );
    const v = lerp(
      lerp(V[r0 * GW + c0w], V[r0 * GW + c1w], tx),
      lerp(V[r1 * GW + c0w], V[r1 * GW + c1w], tx),
      ty,
    );
    if (Number.isNaN(u) || Number.isNaN(v)) return null;
    return { u, v };
  }
}

/** Fill NaN cells by iteratively averaging filled neighbours (lon wraps). */
function fillHoles(grid: Float32Array): void {
  for (let pass = 0; pass < 40; pass++) {
    let filledAny = false;
    const next = grid.slice();
    for (let r = 0; r < GH; r++) {
      for (let c = 0; c < GW; c++) {
        const i = r * GW + c;
        if (!Number.isNaN(grid[i])) continue;
        let sum = 0;
        let n = 0;
        const neigh = [
          r * GW + ((c - 1 + GW) % GW),
          r * GW + ((c + 1) % GW),
          (r - 1) * GW + c,
          (r + 1) * GW + c,
        ];
        for (const j of neigh) {
          if (j < 0 || j >= grid.length) continue;
          if (!Number.isNaN(grid[j])) {
            sum += grid[j];
            n++;
          }
        }
        if (n > 0) {
          next[i] = sum / n;
          filledAny = true;
        }
      }
    }
    grid.set(next);
    if (!filledAny) break;
  }
  // Any cell still NaN (no data at all) → 0 so sampling never returns NaN-noise.
  for (let i = 0; i < grid.length; i++) if (Number.isNaN(grid[i])) grid[i] = 0;
}

// ── Particles ────────────────────────────────────────────────────────────────

export interface Particle {
  lat: number;
  lon: number;
  age: number;
  life: number;
  /** Recent positions [lat, lon, lat, lon, …], newest last. */
  hist: number[];
  speed: number;
}

const HIST = 8;

function reseed(p: Particle): void {
  p.lon = Math.random() * 360 - 180;
  // Bias toward mid-latitudes (less clustering at poles) via a soft curve.
  p.lat = (Math.random() - 0.5) * 170;
  p.age = 0;
  p.life = 50 + Math.random() * 90;
  p.hist.length = 0;
  p.speed = 0;
}

export function createParticles(count: number): Particle[] {
  const ps: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const p: Particle = { lat: 0, lon: 0, age: 0, life: 0, hist: [], speed: 0 };
    reseed(p);
    p.age = Math.floor(Math.random() * p.life); // stagger initial respawns
    ps.push(p);
  }
  return ps;
}

/**
 * Advance every particle one step.
 * @param scale  degrees of travel per (m/s) per step — tune for visible motion.
 */
export function stepParticles(
  particles: Particle[],
  field: WindField,
  scale: number,
): void {
  for (const p of particles) {
    const s = field.sample(p.lat, p.lon);
    if (!s || p.age++ > p.life) {
      reseed(p);
      continue;
    }
    p.speed = Math.hypot(s.u, s.v);
    p.hist.push(p.lat, p.lon);
    if (p.hist.length > HIST * 2) p.hist.splice(0, 2);

    const cosLat = Math.max(0.25, Math.cos((p.lat * Math.PI) / 180));
    p.lon += (s.u * scale) / cosLat;
    p.lat += s.v * scale;

    if (p.lat > 89 || p.lat < -89) {
      reseed(p);
      continue;
    }
    if (p.lon > 180) p.lon -= 360;
    else if (p.lon < -180) p.lon += 360;
  }
}
