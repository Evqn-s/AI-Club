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

    const NUM_STRANDS = 10;
    const X_STEP = 6;
    const RIB_SPACING = 54; // Distance between subtle 3D vertical mesh lines

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

      // Detect theme on each frame so theme-switching is reactive
      const isLight = document.documentElement.classList.contains("light");

      // 0. Environmental proximity glow pass:
      // Casts a soft radiant aura that illuminates elements (title, buttons, cards) close to the wave as it moves
      ctx.save();
      const primaryGlow = isLight ? "rgba(59, 130, 246, 0.48)" : "rgba(239, 68, 68, 0.52)";
      const ambientGlow = isLight ? "rgba(96, 165, 250, 0.28)" : "rgba(244, 63, 94, 0.3)";
      const midStrandIdx = Math.floor(NUM_STRANDS / 2);
      const leadStrandPoints = points[midStrandIdx];

      if (leadStrandPoints && leadStrandPoints.length > 0) {
        // Broad environmental halo (washes light onto nearby text & cards)
        ctx.beginPath();
        for (let i = 0; i < leadStrandPoints.length; i++) {
          const pt = leadStrandPoints[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = ambientGlow;
        ctx.lineWidth = 16;
        ctx.shadowColor = primaryGlow;
        ctx.shadowBlur = 54;
        ctx.stroke();

        // Focused inner radiance
        ctx.lineWidth = 5;
        ctx.shadowBlur = 26;
        ctx.stroke();
      }
      ctx.restore();

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
        const ribColor = isLight
          ? `rgba(37, 99, 235, ${(0.09 * edgeFactor).toFixed(3)})`
          : `rgba(180, 50, 70, ${(0.09 * edgeFactor).toFixed(3)})`;
        ctx.strokeStyle = ribColor;
        ctx.lineWidth = 0.85;
        ctx.shadowColor = ribColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
      }

      // 2. Draw longitudinal 3D ribbon strands from back to front with luminous glow
      for (let s = 0; s < NUM_STRANDS; s++) {
        const d = s / (NUM_STRANDS - 1);
        const strandPoints = points[s];
        const maxAlpha = 0.16 + d * 0.42;

        let r: number, g: number, b: number;
        if (isLight) {
          // Blue palette: deep navy (back) → vivid sapphire (front)
          r = Math.round(30 + d * 37);    // 30 → 67
          g = Math.round(64 + d * 86);   // 64 → 150
          b = Math.round(175 + d * 60);  // 175 → 235
        } else {
          // Crimson/rose palette: dark maroon (back) → glowing rose (front)
          r = Math.round(150 + d * 74);  // 150 → 224
          g = Math.round(35 + d * 128);  // 35 → 163
          b = Math.round(55 + d * 115);  // 55 → 170
        }

        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${maxAlpha.toFixed(3)})`);
        grad.addColorStop(0.82, `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.0 + d * 1.2;

        if (s >= NUM_STRANDS - 4) {
          ctx.shadowColor = isLight
            ? `rgba(59, 130, 246, ${(0.45 + d * 0.4).toFixed(2)})`
            : `rgba(244, 63, 94, ${(0.45 + d * 0.4).toFixed(2)})`;
          ctx.shadowBlur = Math.round(16 + d * 22); // 16px to 38px radiant bloom
        } else {
          ctx.shadowColor = isLight
            ? `rgba(37, 99, 235, 0.2)`
            : `rgba(180, 50, 70, 0.2)`;
          ctx.shadowBlur = 8;
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
