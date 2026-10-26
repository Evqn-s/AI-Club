import { SineWaveBackground } from "./SineWaveBackground";

// Composes all fixed decorative layers behind the interactive application.
export function OrganicBackground() {
  return (
    <div className="organic-background fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Subtle oscillating sine wave with fade-in on site load */}
      <SineWaveBackground />

      {/* Subtle ambient Apple spatial glow for backdrop-blur refraction */}
      <div className="ambient-glow ambient-glow-top absolute top-[12%] left-1/2 -translate-x-1/2 w-[min(94vw,950px)] h-[440px] bg-gradient-to-b from-[#68131D]/02 via-[#26070D]/01 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="ambient-glow ambient-glow-middle absolute top-[45%] left-1/2 -translate-x-1/2 w-[min(88vw,800px)] h-[380px] bg-gradient-to-r from-[#68131D]/01 via-[#26070D]/01 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Section perimeter accent line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
