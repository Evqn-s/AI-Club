import { useEffect, useRef, useState } from "react";

export function SineWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fadedIn, setFadedIn] = useState(false);

  // Trigger smooth fade-in after mounting
  useEffect(() => {
    const timer = setTimeout(() => setFadedIn(true), 60);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    // When the theme is switched, ThemeBar.tsx dispatches "theme-change".
    // Reduced-motion users have no animation loop, so force a single redraw
    // that snaps the palette to the newly active theme.
    const onThemeChange = () => {
      if (prefersReducedMotion) {
        paletteBlend = document.documentElement.classList.contains("light") ? 1.0 : 0.0;
        draw();
      }
    };
    window.addEventListener("theme-change", onThemeChange);

    const NUM_STRANDS = 10;
    const X_STEP = 6;
    const RIB_SPACING = 54; // Distance between subtle 3D vertical mesh lines

    // Theme palette blending: rather than reading the current theme and
    // snapping to its palette on the very next frame, keep a 0..1 blend
    // (0 = dark crimson/rose, 1 = light blue/sapphire) that eases toward the
    // active theme with the same duration & ease-in-out curve as the CSS
    // transition in index.css (700ms), so the background ribbons "drift"
    // between palettes together with the page elements.
    const THEME_BLEND_MS = 700; // must match THEME_TRANSITION_MS in ThemeBar.tsx / index.css
    let paletteBlend = document.documentElement.classList.contains("light") ? 1.0 : 0.0;
    let blendFrom = paletteBlend;
    let blendTarget = paletteBlend;
    let blendStartTime = -1.0;

    // Cubic ease-in-out, identical shape to CSS `ease-in-out`.
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Dark (crimson/rose) → Light (blue/sapphire) channel pairs per depth step
    const darkBack = { r: 150, g: 35, b: 55 };
    const darkFront = { r: 224, g: 163, b: 170 };
    const lightBack = { r: 30, g: 64, b: 175 };
    const lightFront = { r: 67, g: 150, b: 235 };

    function draw() {
      if (!ctx || !canvas) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerY = Math.max(height * 0.34, 230);

      ctx.clearRect(0, 0, width, height);

      // Pre-calculate 3D ribbon grid points
      // Each strand i has depth d in [0, 1] (0 = back, 1 = front)
      const points: { x: number; y: number }[][] = [];

      for (let s = 0; s < NUM_STRANDS; s++) {
        const d = s / (NUM_STRANDS - 1); // Depth 0 to 1
        const strandPoints: { x: number; y: number }[] = [];

        const baseY = centerY + (d - 0.5) * 60;
        const amp1 = 26 + d * 18;
        const amp2 = 10 + d * 8;
        const depthPhase = phase + d * 1.35;

        for (let x = 0; x <= width; x += X_STEP) {
          const y =
            baseY +
            Math.sin(x * 0.0022 + depthPhase) * amp1 +
            Math.cos(x * 0.0045 + depthPhase * 0.7) * amp2;

          strandPoints.push({ x, y });
        }
        points.push(strandPoints);
      }

      // Ease the palette blend toward the active theme (target 0 or 1) using
      // the same duration & ease-in-out as the CSS transition.
      const isLight = document.documentElement.classList.contains("light");
      const nextTarget = isLight ? 1.0 : 0.0;
      if (nextTarget !== blendTarget) {
        blendTarget = nextTarget;
        blendFrom = paletteBlend;
        blendStartTime = performance.now();
      }

      if (blendStartTime >= 0) {
        const progress = Math.min(1, (performance.now() - blendStartTime) / THEME_BLEND_MS);
        paletteBlend = blendFrom + (blendTarget - blendFrom) * easeInOut(progress);
        if (progress >= 1) blendStartTime = -1;
      } else {
        paletteBlend = blendTarget;
      }

      const mix = (a: number, b: number, t: number) => a + (b - a) * t;

      // Blend between the two palette families once per depth
      const backR = mix(darkBack.r, lightBack.r, paletteBlend);
      const backG = mix(darkBack.g, lightBack.g, paletteBlend);
      const backB = mix(darkBack.b, lightBack.b, paletteBlend);
      const frontR = mix(darkFront.r, lightFront.r, paletteBlend);
      const frontG = mix(darkFront.g, lightFront.g, paletteBlend);
      const frontB = mix(darkFront.b, lightFront.b, paletteBlend);

      // 1. Draw subtle 3D transverse ribs
      const numSteps = points[0]?.length || 0;
      for (let pIdx = 0; pIdx < numSteps; pIdx += Math.round(RIB_SPACING / X_STEP)) {
        const x = points[0][pIdx].x;
        const edgeFactor = Math.sin((x / width) * Math.PI);
        if (edgeFactor <= 0.05) continue;

        ctx.beginPath();
        for (let s = 0; s < NUM_STRANDS; s++) {
          const pt = points[s][pIdx];
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        const ribR = Math.round(mix(180, 37, paletteBlend));
        const ribG = Math.round(mix(50, 99, paletteBlend));
        const ribB = Math.round(mix(70, 235, paletteBlend));
        ctx.strokeStyle = `rgba(${ribR}, ${ribG}, ${ribB}, ${(0.07 * edgeFactor).toFixed(3)})`;
        ctx.lineWidth = 0.75;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }

      // 2. Draw longitudinal 3D ribbon strands from back to front
      for (let s = 0; s < NUM_STRANDS; s++) {
        const d = s / (NUM_STRANDS - 1);
        const strandPoints = points[s];
        const maxAlpha = 0.12 + d * 0.36;

        const r = Math.round(mix(backR, frontR, d));
        const g = Math.round(mix(backG, frontG, d));
        const b = Math.round(mix(backB, frontB, d));

        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${maxAlpha.toFixed(3)})`);
        grad.addColorStop(0.82, `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.9 + d * 0.8;

        if (s >= NUM_STRANDS - 3) {
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }

        for (let i = 0; i < strandPoints.length; i++) {
          const pt = strandPoints[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        phase += 0.0035; // Much slower, serene fluid drift (down from 0.014)
        animationFrameId = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("theme-change", onThemeChange);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none transition-opacity duration-1500 ease-out ${
        fadedIn ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
