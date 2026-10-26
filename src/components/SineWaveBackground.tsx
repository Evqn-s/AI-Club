import { useEffect, useRef, useState } from "react";

const NUM_STRANDS = 10;
const X_STEP = 6;
const MAX_GRID_CELLS = 180_000;

// Controls only how much water ripples affect the sine strands: 0 disables
// Controls only how strongly ripples deform the sine strands: 0 disables
// their response, 1 preserves the original effect, and 2 produces four times
// the original displacement while returning more slowly.
const RIPPLE_ELASTICITY = 1;
const STRAND_RIPPLE_SCALE = 2 * RIPPLE_ELASTICITY ** 2;
const WAVE_STRENGTH = 0.25;
const WAVE_SPEED = 0.25;
const DAMPENING = 0.96;
const WAVE_FREQ = 0.08;
const STRAND_RETURN_RATE = 0.025 / Math.max(RIPPLE_ELASTICITY, 0.01);

export function SineWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fadedIn, setFadedIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadedIn(true), 60);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const targetCanvas = canvas;
    const context = ctx;

    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let scaleFactor = 4;
    let phase = 0;
    let buffer1 = new Float32Array();
    let buffer2 = new Float32Array();
    let imgData = new ImageData(1, 1);
    let pixels32 = new Uint32Array(imgData.data.buffer);
    let cachedGrads: CanvasGradient[] = [];
    let smoothedDisplacements: Float32Array[] = [];
    let isPaused = false;
    let isLight = document.documentElement.classList.contains("light");
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isLittleEndian =
      new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const mouse = {
      x: -1000,
      y: -1000,
      prevX: -1000,
      prevY: -1000,
      isHovered: false,
    };

    function packPixel(r: number, g: number, b: number, a: number) {
      return isLittleEndian
        ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
        : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    }

    function buildGradients() {
      cachedGrads = Array.from({ length: NUM_STRANDS }, (_, s) => {
        const depth = s / (NUM_STRANDS - 1);
        const maxAlpha = isLight ? 0.12 + depth * 0.36 : 0.32 + depth * 0.3;
        const r = isLight
          ? Math.round(30 + depth * 37)
          : Math.round(218 + depth * 32);
        const g = isLight
          ? Math.round(64 + depth * 86)
          : Math.round(38 + depth * 24);
        const b = isLight
          ? Math.round(175 + depth * 60)
          : Math.round(50 + depth * 28);
        const gradient = context.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(
          0.18,
          `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`,
        );
        gradient.addColorStop(
          0.5,
          `rgba(${r}, ${g}, ${b}, ${maxAlpha.toFixed(3)})`,
        );
        gradient.addColorStop(
          0.82,
          `rgba(${r}, ${g}, ${b}, ${(maxAlpha * 0.35).toFixed(3)})`,
        );
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        return gradient;
      });
    }

    function initBuffers() {
      width = window.innerWidth || 1;
      height = window.innerHeight || 1;
      scaleFactor = Math.max(
        4,
        Math.ceil(Math.sqrt((width * height) / MAX_GRID_CELLS)),
      );
      cols = Math.max(3, Math.floor(width / scaleFactor));
      rows = Math.max(3, Math.floor(height / scaleFactor));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      targetCanvas.width = width * dpr;
      targetCanvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      buffer1 = new Float32Array(cols * rows);
      buffer2 = new Float32Array(cols * rows);
      imgData = new ImageData(cols, rows);
      pixels32 = new Uint32Array(imgData.data.buffer);
      smoothedDisplacements = Array.from(
        { length: NUM_STRANDS },
        () => new Float32Array(Math.ceil(width / X_STEP) + 1),
      );

      if (tempCanvas.width !== cols || tempCanvas.height !== rows) {
        tempCanvas.width = cols;
        tempCanvas.height = rows;
      }
      buildGradients();
    }

    function injectContinuousWake() {
      if (!mouse.isHovered) return;
      const dx = mouse.x - mouse.prevX;
      const dy = mouse.y - mouse.prevY;
      const distance = Math.hypot(dx, dy);
      const speed = Math.min(distance, 50);
      const impulse = 40 * WAVE_STRENGTH + speed * 1.8 * WAVE_STRENGTH;
      const steps = Math.max(1, Math.floor(distance / scaleFactor));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const currentX = (mouse.prevX + dx * t) / scaleFactor;
        const currentY = (mouse.prevY + dy * t) / scaleFactor;
        const gridCol = Math.floor(currentX);
        const gridRow = Math.floor(currentY);

        for (let rowDelta = -5; rowDelta <= 5; rowDelta++) {
          for (let colDelta = -5; colDelta <= 5; colDelta++) {
            const row = gridRow + rowDelta;
            const col = gridCol + colDelta;
            if (row <= 0 || row >= rows - 1 || col <= 0 || col >= cols - 1) {
              continue;
            }
            const distanceFromPoint = Math.hypot(
              col - currentX,
              row - currentY,
            );
            const brushRadius = 5;
            if (distanceFromPoint < brushRadius) {
              const factor = Math.cos(
                (distanceFromPoint / brushRadius) * (Math.PI / 2),
              );
              buffer1[row * cols + col] += impulse * factor * 0.15;
            }
          }
        }
      }
    }

    function triggerClickRipple(clickX: number, clickY: number) {
      const gridCol = Math.floor(clickX / scaleFactor);
      const gridRow = Math.floor(clickY / scaleFactor);
      const clickImpulse = 130 * WAVE_STRENGTH;

      for (let rowDelta = -10; rowDelta <= 10; rowDelta++) {
        for (let colDelta = -10; colDelta <= 10; colDelta++) {
          const row = gridRow + rowDelta;
          const col = gridCol + colDelta;
          if (row <= 0 || row >= rows - 1 || col <= 0 || col >= cols - 1) {
            continue;
          }
          const distanceFromClick = Math.hypot(colDelta, rowDelta);
          const rippleRadius = 9;
          if (distanceFromClick < rippleRadius) {
            const factor = Math.cos(
              (distanceFromClick / rippleRadius) * (Math.PI / 2),
            );
            buffer1[row * cols + col] += clickImpulse * factor;
          }
        }
      }
    }

    function processWavePhysics() {
      for (let row = 1; row < rows - 1; row++) {
        const rowOffset = row * cols;
        for (let col = 1; col < cols - 1; col++) {
          const index = rowOffset + col;
          const neighborAverage =
            (buffer1[index - 1] +
              buffer1[index + 1] +
              buffer1[index - cols] +
              buffer1[index + cols]) *
            0.5;
          buffer2[index] = (neighborAverage - buffer2[index]) * DAMPENING;
        }
      }
      [buffer1, buffer2] = [buffer2, buffer1];
    }

    function renderSurfaceAndWaves() {
      let pixelIndex = 0;
      for (let row = 0; row < rows; row++) {
        const rowOffset = row * cols;
        for (let col = 0; col < cols; col++) {
          const index = rowOffset + col;
          if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
            pixels32[pixelIndex++] = 0;
            continue;
          }

          const gradX = buffer1[index + 1] - buffer1[index - 1];
          const gradY = buffer1[index + cols] - buffer1[index - cols];
          const slope = Math.hypot(gradX, gradY) * WAVE_SPEED;
          const displacement = Math.abs(buffer1[index]);
          const modulation = Math.abs(Math.sin(displacement * WAVE_FREQ));
          const intensity = Math.min(
            (slope * 3.5 + displacement * 0.15) * (0.6 + 0.4 * modulation),
            255,
          );

          if (intensity < 0.8) {
            pixels32[pixelIndex++] = 0;
          } else {
            const alpha = Math.floor(255 * Math.min(intensity / 255, 0.85));
            const red = isLight ? 10 : 235;
            const green = isLight ? 132 : 30;
            const blue = isLight ? 255 : 45;
            pixels32[pixelIndex++] = packPixel(red, green, blue, alpha);
          }
        }
      }

      tempCtx?.putImageData(imgData, 0, 0);
      context.save();
      context.setTransform(
        Math.min(window.devicePixelRatio || 1, 2),
        0,
        0,
        Math.min(window.devicePixelRatio || 1, 2),
        0,
        0,
      );
      context.clearRect(0, 0, width, height);
      if (tempCtx) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(tempCanvas, 0, 0, cols, rows, 0, 0, width, height);
      }

      const centerY = Math.max(height * 0.34, 230);
      for (let strand = 0; strand < NUM_STRANDS; strand++) {
        const depth = strand / (NUM_STRANDS - 1);
        const baseY = centerY + (depth - 0.5) * 60;
        const amp1 = 26 + depth * 18;
        const amp2 = 10 + depth * 8;
        const depthPhase = phase + depth * 1.35;
        const displacements = smoothedDisplacements[strand];

        context.beginPath();
        let pointIndex = 0;
        for (let x = 0; x <= width; x += X_STEP) {
          let y =
            baseY +
            Math.sin(x * 0.0022 + depthPhase) * amp1 +
            Math.cos(x * 0.0045 + depthPhase * 0.7) * amp2;
          const gridCol = Math.floor(x / scaleFactor);
          const gridRow = Math.floor(y / scaleFactor);
          let targetDisplacement = 0;
          if (gridCol > 0 && gridCol < cols && gridRow > 0 && gridRow < rows) {
            targetDisplacement =
              buffer1[gridRow * cols + gridCol] * STRAND_RIPPLE_SCALE;
          }

          displacements[pointIndex] +=
            (targetDisplacement - displacements[pointIndex]) *
            STRAND_RETURN_RATE;
          y += displacements[pointIndex];
          if (pointIndex === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
          pointIndex++;
        }

        context.strokeStyle = cachedGrads[strand] || "transparent";
        if (strand >= NUM_STRANDS - 3) {
          context.save();
          context.lineWidth = (0.9 + depth * 0.8) * 3;
          context.globalAlpha = isLight ? 0.25 : 0.4;
          context.stroke();
          context.restore();
        }
        context.lineWidth = 0.9 + depth * 0.8;
        context.stroke();
      }
      context.restore();
    }

    function drawFrame() {
      animationFrameId = 0;
      if (isPaused) return;
      injectContinuousWake();
      processWavePhysics();
      renderSurfaceAndWaves();
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      if (!prefersReducedMotion) {
        phase += 0.0035;
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    }

    function handlePause() {
      isPaused = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    }

    function handleResume() {
      if (!isPaused) return;
      isPaused = false;
      drawFrame();
    }

    function updateMousePos(clientX: number, clientY: number) {
      if (!mouse.isHovered) {
        mouse.prevX = clientX;
        mouse.prevY = clientY;
        mouse.isHovered = true;
      }
      mouse.x = clientX;
      mouse.y = clientY;
    }

    function handleMouseMove(event: MouseEvent) {
      updateMousePos(event.clientX, event.clientY);
    }

    function handleMouseDown(event: MouseEvent) {
      triggerClickRipple(event.clientX, event.clientY);
    }

    function handleMouseLeave() {
      mouse.isHovered = false;
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) triggerClickRipple(touch.clientX, touch.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) updateMousePos(touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
      mouse.isHovered = false;
    }

    function handleThemeChange() {
      const currentIsLight =
        document.documentElement.classList.contains("light");
      if (currentIsLight !== isLight) {
        isLight = currentIsLight;
        buildGradients();
      }
    }

    const themeObserver = new MutationObserver(handleThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    initBuffers();
    drawFrame();
    window.addEventListener("resize", initBuffers);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("calendar:transition-start", handlePause);
    window.addEventListener("calendar:transition-end", handleResume);

    return () => {
      themeObserver.disconnect();
      window.removeEventListener("resize", initBuffers);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("calendar:transition-start", handlePause);
      window.removeEventListener("calendar:transition-end", handleResume);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
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
        className="block h-full w-full"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
