import { SineWaveBackground } from "./SineWaveBackground";

export function OrganicBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Subtle oscillating sine wave with fade-in on site load */}
      <SineWaveBackground />

      {/* Section perimeter accent line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#221E1F] to-transparent" />
    </div>
  );
}
