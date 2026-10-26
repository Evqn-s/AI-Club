// Fit the validator's observed fold frames to cubic-bezier(0.4,0,0.2,1)
// to infer the real animation start time and duration.
const P0 = [0, 0], P1 = [0.4, 0], P2 = [0.2, 1], P3 = [1, 1];
const bez = (a, b) => (t) => {
  const mt = 1 - t;
  return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;
};
const cx = bez(P1[0], P2[0]);
const cy = bez(P1[1], P2[1]);
const ease = (x) => {
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 60; i++) {
    t = (lo + hi) / 2;
    if (cx(t) < x) lo = t; else hi = t;
  }
  return cy(t);
};

const frames = [
  { t: 146, ty: [0.36, 2.59, 0, -2.59, -0.36] },
  { t: 222, ty: [52.61, 45.43, 0, -45.43, -52.61] },
  { t: 303, ty: [162.68, 87.86, 0, -87.86, -162.68] },
  { t: 443, ty: [196.12, 99.34, 0, -99.34, -196.12] },
];
const deltas = [2, 1, 0, -1, -2];
const target = [200, 100, 0, 100, 200];
const STAG = 20, DUR = 280;

let best = null;
for (let start = 0; start <= 300; start += 0.5) {
  for (let dur = 200; dur <= 400; dur += 2) {
    let err = 0;
    for (const f of frames) {
      for (let i = 0; i < 5; i++) {
        const p = Math.max(0, Math.min(1, (f.t - start - Math.abs(deltas[i]) * STAG) / dur));
        const y = ease(p) * target[i];
        err += (y - f.ty[i]) ** 2;
      }
    }
    if (!best || err < best.err) best = { start, dur, err };
  }
}
console.log("best fit: start=%sms dur=%sms rms=%s", best.start, best.dur, Math.sqrt(best.err / 20).toFixed(3));

const s = best.start, d = best.dur;
for (const f of frames) {
  const out = deltas.map((dl, i) => {
    const p = Math.max(0, Math.min(1, (f.t - s - Math.abs(dl) * STAG) / d));
    return (ease(p) * target[i]).toFixed(2);
  });
  console.log(f.t, "observed", f.ty.join(","), "| fit", out.join(","));
}
console.log("implied animation end (last row):", s + 2 * STAG + d, "ms after click");
console.log("MODE_FOLD_MS = 460 -> grid unmounts at 460ms");
