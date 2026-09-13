import { ThemeToggle } from "@/components/ThemeToggle";

export { ThemeProvider, useTheme } from "@/components/ThemeToggle";

export function ThemeBar({ className = "" }: { className?: string }) {
  return (
    <div role="group" aria-label="Color theme switcher" className={className}>
      <ThemeToggle />
    </div>
  );
}
