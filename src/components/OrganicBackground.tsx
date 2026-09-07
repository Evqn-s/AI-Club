import { SineWaveBackground } from "./SineWaveBackground";

export function OrganicBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Subtle oscillating sine wave with fade-in on site load */}
      <SineWaveBackground />

      {/* Top right organic curve (oxblood/crimson tint) */}
      <svg
        className="absolute -top-32 -right-32 w-[600px] h-[600px] opacity-40 text-[#241416]"
        viewBox="0 0 500 500"
        fill="currentColor"
      >
        <path d="M420,80 C480,180 490,320 400,410 C310,500 170,490 80,410 C-10,330 0,170 80,80 C160,-10 360,-20 420,80 Z" />
      </svg>

      {/* Mid left organic structural wave */}
      <svg
        className="absolute top-1/3 -left-48 w-[700px] h-[700px] opacity-25 text-[#141213]"
        viewBox="0 0 600 600"
        fill="currentColor"
      >
        <path d="M520,180 C580,290 530,440 430,510 C330,580 180,570 90,480 C0,390 -30,220 50,120 C130,20 320,-10 420,50 C470,80 490,120 520,180 Z" />
      </svg>

      {/* Bottom right subtle tonal accent */}
      <svg
        className="absolute -bottom-40 right-10 w-[550px] h-[550px] opacity-20 text-[#241416]"
        viewBox="0 0 500 500"
        fill="currentColor"
      >
        <path d="M380,110 C460,190 470,330 400,420 C330,510 180,500 90,420 C0,340 10,180 90,100 C170,20 300,30 380,110 Z" />
      </svg>

      {/* Section perimeter accent line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#221E1F] to-transparent" />
    </div>
  );
}
