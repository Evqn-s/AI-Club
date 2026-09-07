import { useEffect, useRef, useState } from "react";

export function SineWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fadedIn, setFadedIn] = useState(false);

  // Trigger smooth fade-in after mounting
  useEffect(() => {
    const timer = setTimeout(() => setFadedIn(true), 100);
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
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx?.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerY = height * 0.48; // Positioned slightly above center behind hero/content

      ctx.clearRect(0, 0, width, height);

      // Horizontal linear gradient to fade edges smoothly at screen boundaries
      const grad1 = ctx.createLinearGradient(0, 0, width, 0);
      grad1.addColorStop(0, "rgba(224, 163, 170, 0)");
      grad1.addColorStop(0.15, "rgba(224, 163, 170, 0.08)");
      grad1.addColorStop(0.5, "rgba(224, 163, 170, 0.18)");
      grad1.addColorStop(0.85, "rgba(224, 163, 170, 0.08)");
      grad1.addColorStop(1, "rgba(224, 163, 170, 0)");

      const grad2 = ctx.createLinearGradient(0, 0, width, 0);
      grad2.addColorStop(0, "rgba(155, 44, 59, 0)");
      grad2.addColorStop(0.2, "rgba(155, 44, 59, 0.05)");
      grad2.addColorStop(0.5, "rgba(155, 44, 59, 0.13)");
      grad2.addColorStop(0.8, "rgba(155, 44, 59, 0.05)");
      grad2.addColorStop(1, "rgba(155, 44, 59, 0)");

      // Wave 1 - Primary subtle sine wave
      ctx.beginPath();
      ctx.strokeStyle = grad1;
      ctx.lineWidth = 1.5;

      const step = 4;
      for (let x = 0; x <= width; x += step) {
        // Combined subtle sine waves for organic harmonic feel
        const y =
          centerY +
          Math.sin(x * 0.0022 + phase) * 32 +
          Math.sin(x * 0.0048 + phase * 0.7) * 14;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Wave 2 - Secondary harmonic wave with phase offset
      ctx.beginPath();
      ctx.strokeStyle = grad2;
      ctx.lineWidth = 1;

      for (let x = 0; x <= width; x += step) {
        const y =
          centerY +
          Math.sin(x * 0.0019 + phase * 0.85 + 2.0) * 24 +
          Math.cos(x * 0.0038 + phase * 0.6) * 10;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      if (!prefersReducedMotion) {
        phase += 0.008; // Very slow, calm oscillation
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
