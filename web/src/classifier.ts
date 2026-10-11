/** Direct port of ../recognition.py. Geometry rules, never model confidence. */
export type Point = [number, number, number];
export const SUPPORTED = ['F', 'I', 'L', 'V', 'W', 'Y'] as const;
export const UNKNOWN = 'Unknown';
export const NO_HAND = 'No hand detected';
export const distance = (a: Point, b: Point) => Math.hypot(...a.map((x, i) => x - b[i]));
function angle(a: Point, b: Point, c: Point) {
  const divisor = distance(a, b) * distance(c, b);
  if (divisor < 1e-8) return 0;
  const dot = a.reduce((sum, x, i) => sum + (x - b[i]) * (c[i] - b[i]), 0);
  return Math.acos(Math.max(-1, Math.min(1, dot / divisor))) * 180 / Math.PI;
}
export function classify(points: Point[]): string {
  if (points.length !== 21 || points.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v)))) return UNKNOWN;
  const scale = distance(points[0], points[9]);
  if (scale < 1e-6) return UNKNOWN;
  const p = points.map(point => point.map((v, i) => (v - points[0][i]) / scale) as Point);
  if (p[9][1] > -0.45 || Math.abs(p[9][0]) > 0.8 || Math.abs(p[5][0] - p[17][0]) < 0.35) return UNKNOWN;
  const state = (base: number) => {
    const pip = base + 1, dip = base + 2, tip = base + 3;
    const straight = angle(p[base], p[pip], p[dip]) > 155 && angle(p[pip], p[dip], p[tip]) > 150;
    if (straight && distance(p[tip], p[0]) > distance(p[pip], p[0]) + 0.20) return 'up';
    if (angle(p[base], p[pip], p[dip]) < 135 && distance(p[tip], p[base]) < 0.8) return 'down';
    return 'uncertain';
  };
  const states = [5, 9, 13, 17].map(state);
  const [index, middle, ring, pinky] = states;
  const shape = states.join(',');
  const thumbOut = angle(p[2], p[3], p[4]) > 150 && distance(p[4], p[5]) > 0.65 && Math.abs(p[4][0] - p[5][0]) > 0.45;
  const thumbIn = distance(p[4], p[9]) < 0.65;
  if (shape === 'up,down,down,down' && thumbOut) {
    const a = angle(p[4], p[5], p[8]);
    if (55 < a && a < 125) return 'L';
  }
  if (shape === 'down,down,down,up') {
    if (thumbOut) return 'Y';
    if (thumbIn) return 'I';
  }
  if (shape === 'up,up,down,down' && thumbIn) {
    const sameOrder = (p[8][0] - p[12][0]) * (p[5][0] - p[9][0]) > 0;
    if (sameOrder && distance(p[8], p[12]) > 0.45 && angle(p[8], p[0], p[12]) > 12) return 'V';
  }
  if (shape === 'up,up,up,down' && thumbIn && distance(p[8], p[12]) > 0.35 && distance(p[12], p[16]) > 0.35) return 'W';
  if (middle === 'up' && ring === 'up' && pinky === 'up' && index !== 'up'
    && distance(p[4], p[8]) < 0.23 && distance(p[8], p[5]) < 0.85) return 'F';
  return UNKNOWN;
}

export class Smoother {
  private history: string[] = [];
  private current = UNKNOWN;
  private misses = 0;
  reset() { this.history = []; this.current = UNKNOWN; this.misses = 0; }
  update(label: string | null): string {
    if (label === null) { this.reset(); return NO_HAND; }
    this.history.push(label);
    if (this.history.length > 8) this.history.shift();
    this.misses = label === UNKNOWN ? this.misses + 1 : 0;
    if (this.misses >= 3) { this.reset(); return UNKNOWN; }
    const counts = new Map<string, number>();
    for (const item of this.history) counts.set(item, (counts.get(item) ?? 0) + 1);
    const [winner, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (count >= 6 && winner === label) this.current = winner;
    else if (label !== this.current && label !== UNKNOWN) this.current = UNKNOWN;
    return this.current;
  }
}
