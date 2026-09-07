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

    function draw() {
      if (!ctx || !canvas) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // --- UPPER HERO WAVE BAND (Positioned directly under "AI Club" and across CTA buttons) ---
      const heroCenterY = Math.max(height * 0.32, 220);

      // Hero Wave 1: Ambient deep crimson undertone
      const heroGradAmb = ctx.createLinearGradient(0, 0, width, 0);
      heroGradAmb.addColorStop(0, "rgba(180, 40, 60, 0)");
      heroGradAmb.addColorStop(0.1, "rgba(180, 40, 60, 0.2)");
      heroGradAmb.addColorStop(0.5, "rgba(220, 50, 80, 0.45)");
      heroGradAmb.addColorStop(0.9, "rgba(180, 40, 60, 0.2)");
      heroGradAmb.addColorStop(1, "rgba(180, 40, 60, 0)");

      ctx.beginPath();
      ctx.strokeStyle = heroGradAmb;
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(220, 50, 80, 0.4)";
      ctx.shadowBlur = 8;
      const step = 3;

      for (let x = 0; x <= width; x += step) {
        const y =
          heroCenterY +
          Math.sin(x * 0.0018 + phase * 0.7 + 1.5) * 36 +
          Math.cos(x * 0.0035 + phase * 0.5) * 16;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Hero Wave 2: Crimson harmonic wave
      const heroGradCrimson = ctx.createLinearGradient(0, 0, width, 0);
      heroGradCrimson.addColorStop(0, "rgba(255, 77, 109, 0)");
      heroGradCrimson.addColorStop(0.12, "rgba(255, 77, 109, 0.25)");
      heroGradCrimson.addColorStop(0.5, "rgba(255, 77, 109, 0.65)");
      heroGradCrimson.addColorStop(0.88, "rgba(255, 77, 109, 0.25)");
      heroGradCrimson.addColorStop(1, "rgba(255, 77, 109, 0)");

      ctx.beginPath();
      ctx.strokeStyle = heroGradCrimson;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = "rgba(255, 77, 109, 0.5)";
      ctx.shadowBlur = 10;

      for (let x = 0; x <= width; x += step) {
        const y =
          heroCenterY +
          Math.sin(x * 0.0026 + phase * 0.9 + 3.0) * 44 +
          Math.cos(x * 0.0048 + phase * 0.6) * 18;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Hero Wave 3: Primary luminescent rose sine wave
      const heroGradRose = ctx.createLinearGradient(0, 0, width, 0);
      heroGradRose.addColorStop(0, "rgba(224, 163, 170, 0)");
      heroGradRose.addColorStop(0.15, "rgba(224, 163, 170, 0.35)");
      heroGradRose.addColorStop(0.5, "rgba(224, 163, 170, 0.85)");
      heroGradRose.addColorStop(0.85, "rgba(224, 163, 170, 0.35)");
      heroGradRose.addColorStop(1, "rgba(224, 163, 170, 0)");

      ctx.beginPath();
      ctx.strokeStyle = heroGradRose;
      ctx.lineWidth = 2.8;
      ctx.shadowColor = "rgba(224, 163, 170, 0.7)";
      ctx.shadowBlur = 14;

      for (let x = 0; x <= width; x += step) {
        const y =
          heroCenterY +
          Math.sin(x * 0.003 + phase) * 50 +
          Math.sin(x * 0.006 + phase * 0.8) * 22;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- LOWER SECTION AMBIENT WAVE BAND ---
      const lowerCenterY = height * 0.72;
      const lowerGrad = ctx.createLinearGradient(0, 0, width, 0);
      lowerGrad.addColorStop(0, "rgba(224, 163, 170, 0)");
      lowerGrad.addColorStop(0.2, "rgba(180, 50, 70, 0.2)");
      lowerGrad.addColorStop(0.5, "rgba(224, 163, 170, 0.45)");
      lowerGrad.addColorStop(0.8, "rgba(180, 50, 70, 0.2)");
      lowerGrad.addColorStop(1, "rgba(224, 163, 170, 0)");

      ctx.beginPath();
      ctx.strokeStyle = lowerGrad;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "rgba(224, 163, 170, 0.4)";
      ctx.shadowBlur = 8;

      for (let x = 0; x <= width; x += step) {
        const y =
          lowerCenterY +
          Math.sin(x * 0.0022 + phase * 0.75 + 0.8) * 35 +
          Math.cos(x * 0.0044 + phase * 0.5) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (!prefersReducedMotion) {
        phase += 0.014; // Smooth oscillation
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
      className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-out ${
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
