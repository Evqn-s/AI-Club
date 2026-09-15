import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isSupabaseConfigured, type CalendarEvent } from "@/lib/supabase";
import {
  getCachedCalendar,
  fallbackEvents,
} from "@/lib/cache";
import { prefetchCalendar } from "@/lib/data";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  CalendarDays,
  CalendarRange,
  List,
  ArrowUpDown,
} from "lucide-react";

// Dynamic today — computed once at module load so every helper uses real current date
const _NOW = new Date();
const TODAY_YEAR = _NOW.getFullYear();
const TODAY_MONTH = _NOW.getMonth();   // 0-indexed
const TODAY_DAY = _NOW.getDate();
const TODAY_STRING = `${TODAY_YEAR}-${String(TODAY_MONTH + 1).padStart(2, "0")}-${String(TODAY_DAY).padStart(2, "0")}`;

// Returns the first day of the month that is `monthOffset` months away from today
function getDateForMonth(monthOffset: number): Date {
  return new Date(TODAY_YEAR, TODAY_MONTH + monthOffset, 1, 12, 0, 0);
}

// Returns a date `weekOffset` weeks away from today's week start (Sunday)
function getDateForWeek(weekOffset: number): Date {
  // Anchor to today so week 0 always contains today
  const anchor = new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0);
  const dayOfWeek = anchor.getDay(); // 0 = Sunday
  const sunday = new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY - dayOfWeek, 12, 0, 0);
  return new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + weekOffset * 7, 12, 0, 0);
}

// Robust search date parser: parses "15", "15th", "Sep 15", "September 15", "9/15", "2026-09-15", "Oct 3", etc.
function parseSearchDate(query: string): Date | null {
  const q = query.trim().toLowerCase().replace(/(st|nd|rd|th)$/, "");

  // 1. ISO format: 2026-09-15 or 2026/09/15
  const isoMatch = q.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  }

  // 2. Short format: 9/15 or 09-15
  const slashMatch = q.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (slashMatch) {
    const [, m, d] = slashMatch.map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(TODAY_YEAR, m - 1, d, 12, 0, 0);
    }
  }

  // 3. Month Name + Day: e.g. "sep 15", "september 15", "oct 3", "november 20"
  const monthMap: { names: string[]; m: number }[] = [
    { names: ["jan", "january"], m: 0 },
    { names: ["feb", "february"], m: 1 },
    { names: ["mar", "march"], m: 2 },
    { names: ["apr", "april"], m: 3 },
    { names: ["may"], m: 4 },
    { names: ["jun", "june"], m: 5 },
    { names: ["jul", "july"], m: 6 },
    { names: ["aug", "august"], m: 7 },
    { names: ["sep", "sept", "september"], m: 8 },
    { names: ["oct", "october"], m: 9 },
    { names: ["nov", "november"], m: 10 },
    { names: ["dec", "december"], m: 11 },
  ];

  for (const item of monthMap) {
    for (const name of item.names) {
      const regex = new RegExp(`^${name}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?$`, "i");
      const match = q.match(regex);
      if (match) {
        const day = parseInt(match[1], 10);
        const year = match[2] ? parseInt(match[2], 10) : TODAY_YEAR;
        if (day >= 1 && day <= 31) {
          return new Date(year, item.m, day, 12, 0, 0);
        }
      }
    }
  }

  // 4. Standalone Day number: "15", "day 15", "15th"
  const standaloneDay = q.match(/^(?:day\s+)?(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (standaloneDay) {
    const day = parseInt(standaloneDay[1], 10);
    if (day >= 1 && day <= 31) {
      return new Date(TODAY_YEAR, TODAY_MONTH, day, 12, 0, 0);
    }
  }

  return null;
}

function getMonthData(currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const title = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(currentDate);

  const firstDayIndex = new Date(year, month, 1, 12, 0, 0).getDay();
  const totalDays = new Date(year, month + 1, 0, 12, 0, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0, 12, 0, 0).getDate();

  const days: {
    date: Date;
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
  }[] = [];

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const d = new Date(year, month - 1, dayNum, 12, 0, 0);
    const dYear = d.getFullYear();
    const dMonth = String(d.getMonth() + 1).padStart(2, "0");
    const dDay = String(d.getDate()).padStart(2, "0");
    const dateString = `${dYear}-${dMonth}-${dDay}`;
    days.push({
      date: d,
      dateString,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateString === TODAY_STRING,
    });
  }

  // Days of current month
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i, 12, 0, 0);
    const dYear = d.getFullYear();
    const dMonth = String(d.getMonth() + 1).padStart(2, "0");
    const dDay = String(d.getDate()).padStart(2, "0");
    const dateString = `${dYear}-${dMonth}-${dDay}`;
    days.push({
      date: d,
      dateString,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateString === TODAY_STRING,
    });
  }

  // Leading days of next month (minimum 35 grid slots)
  const remainingSlots = (7 - (days.length % 7)) % 7;
  const targetSlots = days.length + remainingSlots < 35 ? 35 : days.length + remainingSlots;
  const needed = targetSlots - days.length;
  for (let i = 1; i <= needed; i++) {
    const d = new Date(year, month + 1, i, 12, 0, 0);
    const dYear = d.getFullYear();
    const dMonth = String(d.getMonth() + 1).padStart(2, "0");
    const dDay = String(d.getDate()).padStart(2, "0");
    const dateString = `${dYear}-${dMonth}-${dDay}`;
    days.push({
      date: d,
      dateString,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateString === TODAY_STRING,
    });
  }

  return { monthDays: days, monthTitle: title };
}

function getWeekData(currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const anchor = new Date(year, month, day, 12, 0, 0);
  const dayOfWeek = anchor.getDay(); // 0 is Sunday
  const startOfWeek = new Date(year, month, day - dayOfWeek, 12, 0, 0);

  const days: {
    date: Date;
    dateString: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
  }[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + i,
      12,
      0,
      0
    );
    const dYear = dayDate.getFullYear();
    const dMonth = String(dayDate.getMonth() + 1).padStart(2, "0");
    const dDay = String(dayDate.getDate()).padStart(2, "0");
    const dateString = `${dYear}-${dMonth}-${dDay}`;

    days.push({
      date: dayDate,
      dateString,
      dayName: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dayDate),
      dayNumber: dayDate.getDate(),
      isToday: dateString === TODAY_STRING,
    });
  }

  const start = days[0].date;
  const end = days[6].date;
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(start);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(end);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  let title = "";
  if (startYear === endYear && startMonth === endMonth) {
    title = `${startMonth} ${startYear} (Days ${start.getDate()} – ${end.getDate()})`;
  } else if (startYear === endYear) {
    title = `${startMonth} ${startYear} (Days ${start.getDate()} – ${end.getDate()})`;
  } else {
    title = `${startMonth} ${start.getDate()}, ${startYear} – ${endMonth} ${end.getDate()}, ${endYear}`;
  }

  return { weekDays: days, weekTitle: title };
}

// Pure GPU accelerated Cylindrical Coverflow Arc transform
function getCoverflowArcTransform(offset: number, isTransitioning: boolean) {
  if (offset === 0) {
    return {
      rotateY: 0,
      x: 0,
      z: 0,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    };
  }

  // Secondary slides stay fully visible during the slide so the 3D coverflow
  // arc (rotated, receding, translucent) reads exactly as it always did.
  // The main period is distinguished by the translucent veil over the centre
  // slide — see .cal-slide-veil — not by dimming or masking its neighbours.
  const opacity = isTransitioning ? 1 : 0;

  if (offset === -1) {
    return {
      rotateY: 35,
      x: -260,
      z: -180,
      scale: 0.84,
      opacity,
      zIndex: 20,
    };
  }
  if (offset === 1) {
    return {
      rotateY: -35,
      x: 260,
      z: -180,
      scale: 0.84,
      opacity,
      zIndex: 20,
    };
  }
  if (offset <= -2) {
    return {
      rotateY: 55,
      x: -450,
      z: -340,
      scale: 0.68,
      opacity,
      zIndex: 10,
    };
  }
  return {
    rotateY: -55,
    x: 450,
    z: -340,
    scale: 0.68,
    opacity,
    zIndex: 10,
  };
}

const coverflowSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 28,
};

// ==========================================
// MONTH ⇄ WEEK MODE TRANSITION ("deck of cards" / "horizontal blinds")
// Switching to Month keeps the active week's row stationary and fans the
// remaining weeks out vertically from underneath it; switching back folds
// them in again. Animated with Framer Motion (inline transforms) so it works
// on the calendar page where CSS transitions are disabled for instant theming.
// ==========================================

const MODE_FOLD_MS = 240; // month rows collapse back into the active week
const MODE_UNFOLD_MS = 660; // month rows fan out from the active week
const MODE_WEEK_SETTLE_MS = 560; // week events float up and settle

// Splits the flat month-day array into Sun–Sat week rows so each row can be
// animated independently during a mode switch.
function chunkCalendarDays<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// The month rows use Tailwind breakpoint day-cell min-heights + row gaps;
// mirror those rules in JS so the fold/unfold displacement stays in step
// with the actual layout at every viewport width.
function getMonthRowHeightPx(): number {
  const vw = window.innerWidth || 1440;
  // html { font-size: clamp(0.875rem, 0.8125rem + 0.3125vw, 1.125rem) } → px
  const rootFont = Math.min(18, Math.max(14, 13 + vw * 0.003125));
  let cell = 46;
  if (vw >= 1280) cell = 105;
  else if (vw >= 1024) cell = 96;
  else if (vw >= 768) cell = 85;
  else if (vw >= 640) cell = 54;
  let gap = rootFont * 0.25; // gap-1
  if (vw >= 768) gap = rootFont * 0.5; // md:gap-2
  else if (vw >= 640) gap = rootFont * 0.375; // sm:gap-1.5
  return cell + gap;
}

// Finds the month-grid row containing the active week (the week that was on
// screen just before the switch). Falls back to today's row, then row 0.
function resolveActiveRow(
  weeks: { dateString: string }[][],
  anchorSunday: string | null
): number {
  if (anchorSunday) {
    const idx = weeks.findIndex((week) => week.some((d) => d.dateString === anchorSunday));
    if (idx >= 0) return idx;
  }
  const todayIdx = weeks.findIndex((week) => week.some((d) => d.dateString === TODAY_STRING));
  return todayIdx >= 0 ? todayIdx : 0;
}

// ==========================================
// MEMOIZED CALENDAR SUBCOMPONENTS
// ==========================================

// Month Event Button: Compact on desktop, hidden on mobile
const MonthEventCard = memo(function MonthEventCard({
  evt,
  isHighlighted,
  isInteractive,
  onSelect,
  entering,
}: {
  evt: CalendarEvent;
  isHighlighted: boolean;
  isInteractive: boolean;
  onSelect: (evt: CalendarEvent) => void;
  entering: boolean;
}) {
  return (
    <motion.div
      initial={entering ? { y: 8, opacity: 0.3 } : { y: 0, opacity: 1 }}
      animate={
        entering
          ? { y: 0, opacity: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }
          : { y: 0, opacity: 1 }
      }
      style={{ willChange: "transform, opacity" }}
      className="w-full"
    >
      <button
        onClick={(e) => {
          if (!isInteractive) return;
          e.stopPropagation();
          onSelect(evt);
        }}
        className={`w-full text-left p-1 md:p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
          isHighlighted
            ? "bg-[#241416]/90 border-[#E0A3AA] border-t-white/50 ring-2 ring-[#E0A3AA] shadow-[0_0_16px_rgba(224,163,170,0.5)]"
            : "glass-chip"
        }`}
      >
        <div className="space-y-0.5 w-full">
          <div className="flex items-start justify-between gap-1 w-full">
            <span className="text-[11px] font-bold font-display text-[#E5E5E7] leading-tight truncate">
              {evt.title}
            </span>
            <span className="text-[9px] font-mono text-[#E0A3AA] shrink-0 font-semibold">
              {evt.time}
            </span>
          </div>
          {evt.description && (
            <p className="hidden lg:block text-[10px] text-[#9B98A0] leading-snug line-clamp-2 break-words">
              {evt.description}
            </p>
          )}
        </div>
        {evt.location && (
          <div className="hidden lg:flex items-center gap-1 mt-1 pt-0.5 border-t border-[#242021]/60 text-[9px] text-[#67646C] truncate">
            <MapPin className="h-2 w-2 shrink-0 text-[#E0A3AA]" />
            <span className="truncate">{evt.location}</span>
          </div>
        )}
      </button>
    </motion.div>
  );
});

// Month Day Cell: Compact size, NO dot for today's date marker
const MonthDayCell = memo(function MonthDayCell({
  dayObj,
  dayEvents,
  highlightedEventId,
  highlightedDateString,
  isInteractive,
  onSelectEvent,
  entering,
}: {
  dayObj: {
    date: Date;
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
  };
  dayEvents: CalendarEvent[];
  highlightedEventId: string | null;
  highlightedDateString: string | null;
  isInteractive: boolean;
  onSelectEvent: (evt: CalendarEvent) => void;
  entering: boolean;
}) {
  const hasEvents = dayEvents.length > 0;
  const isAnyHighlighted = dayEvents.some((e) => e.id === highlightedEventId);
  const isDateSearched = dayObj.dateString === highlightedDateString;

  return (
    <div
      onClick={() => {
        if (!isInteractive || !hasEvents) return;
        onSelectEvent(dayEvents[0]);
      }}
      className={`min-h-[46px] sm:min-h-[54px] md:min-h-[85px] lg:min-h-[96px] xl:min-h-[105px] rounded-lg md:rounded-xl border p-1 md:p-1.5 flex flex-col justify-between transition-all ${
        hasEvents ? "cursor-pointer md:cursor-default" : ""
      } ${
        dayObj.isCurrentMonth
          ? "glass-cell glass-cell-hover"
          : "backdrop-blur-sm bg-white/[0.015] border-white/5 border-t-white/10 opacity-35"
      } ${
        isDateSearched
          ? "ring-2 ring-[#E0A3AA] border-[#E0A3AA] border-t-[#E0A3AA] shadow-[0_0_18px_rgba(224,163,170,0.4)]"
          : dayObj.isToday
          ? "ring-1 ring-[#E0A3AA] border-[#5E2C32] border-t-white/50 shadow-[0_0_12px_rgba(224,163,170,0.2)]"
          : ""
      } ${
        // Today gets a soft breathing halo (see .cal-today in index.css) so it
        // reads at a glance on the dense month grid. Only in its own month —
        // never on the adjacent-month overflow cells.
        dayObj.isToday && dayObj.isCurrentMonth ? "cal-today" : ""
      }`}
    >
      {/* Day header — NO today dot */}
      <div className="flex items-center justify-between pb-0.5 border-b border-[#242021]/60">
        <span
          className={`text-[10px] md:text-xs font-mono font-semibold ${
            dayObj.isToday
              ? "text-[#E0A3AA] font-bold"
              : dayObj.isCurrentMonth
              ? "text-[#E5E5E7]"
              : "text-[#67646C]"
          }`}
        >
          {dayObj.dayNumber}
        </span>
        {dayObj.isToday && (
          <span className="text-[9px] font-mono uppercase text-[#E0A3AA] font-bold px-1.5 py-0.5 rounded bg-[#241416] border border-[#5E2C32] hidden md:inline">
            Today
          </span>
        )}
      </div>

      {/* MOBILE (< 768px): Just an accent dot for scheduled activities */}
      <div className="flex md:hidden items-center justify-center gap-1 py-1 flex-1">
        {dayEvents.map((evt) => (
          <span
            key={evt.id}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              evt.id === highlightedEventId || isAnyHighlighted || isDateSearched
                ? "bg-[#E0A3AA] ring-2 ring-[#E0A3AA] scale-125 shadow-[0_0_8px_#E0A3AA]"
                : "bg-[#E0A3AA] shadow-[0_0_6px_rgba(224,163,170,0.6)]"
            }`}
          />
        ))}
      </div>

      {/* DESKTOP (>= 768px): Compact event cards */}
      <div className="hidden md:flex mt-1 flex-1 flex-col w-full gap-1">
        {dayEvents.slice(0, 2).map((evt) => (
          <MonthEventCard
            key={evt.id}
            evt={evt}
            isHighlighted={evt.id === highlightedEventId}
            isInteractive={isInteractive}
            onSelect={onSelectEvent}
            entering={entering}
          />
        ))}
      </div>
    </div>
  );
});

// Mobile Week View (< 768px): Horizontal strip of days + full-view activity or blank "No activity found"
const MobileWeekView = memo(function MobileWeekView({
  weekDays,
  events,
  highlightedEventId,
  highlightedDateString,
  isInteractive,
  onSelectEvent,
  generateGoogleCalendarUrl,
  entering,
  selectedDayString: propSelectedDayString,
  onSelectDay,
}: {
  weekDays: {
    date: Date;
    dateString: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
  }[];
  events: CalendarEvent[];
  highlightedEventId: string | null;
  highlightedDateString: string | null;
  isInteractive: boolean;
  onSelectEvent: (evt: CalendarEvent) => void;
  generateGoogleCalendarUrl: (evt: CalendarEvent) => string;
  entering: boolean;
  selectedDayString?: string;
  onSelectDay?: (day: string) => void;
}) {
  const [internalSelectedDay, setInternalSelectedDay] = useState<string>(() => {
    if (highlightedDateString && weekDays.some((d) => d.dateString === highlightedDateString)) {
      return highlightedDateString;
    }
    const dayWithEvent = weekDays.find((d) => events.some((e) => e.date === d.dateString));
    if (dayWithEvent) return dayWithEvent.dateString;
    const todayMatch = weekDays.find((d) => d.isToday);
    return todayMatch ? todayMatch.dateString : weekDays[0]?.dateString || "";
  });

  // Sync internal state when highlighted date changes
  useEffect(() => {
    if (highlightedDateString && weekDays.some((d) => d.dateString === highlightedDateString)) {
      setInternalSelectedDay(highlightedDateString);
    }
  }, [highlightedDateString, weekDays]);

  const selectedDayString =
    propSelectedDayString && weekDays.some((d) => d.dateString === propSelectedDayString)
      ? propSelectedDayString
      : internalSelectedDay;

  const activeDayObj = weekDays.find((d) => d.dateString === selectedDayString) || weekDays[0];
  const dayEvents = events.filter((e) => e.date === selectedDayString);

  return (
    <div className="flex flex-col gap-3 w-full md:hidden select-text pb-10 sm:pb-12">
      {/* Horizontal Day Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none w-full">
        {weekDays.map((d) => {
          const isSelected = d.dateString === selectedDayString;
          const hasEvents = events.some((e) => e.date === d.dateString);
          return (
            <button
              key={d.dateString}
              onClick={() => {
                if (!isInteractive) return;
                if (onSelectDay) {
                  onSelectDay(d.dateString);
                }
                setInternalSelectedDay(d.dateString);
              }}
              className={`flex-1 min-w-[44px] py-1.5 px-1 rounded-xl border flex flex-col items-center gap-0.5 transition-all shadow-md ${
                isSelected
                  ? "glass-panel ring-1 ring-[#E0A3AA] border-[#E0A3AA] border-t-white/50 text-[#E0A3AA] shadow-[0_0_12px_rgba(224,163,170,0.25)]"
                  : "glass-cell glass-cell-hover text-[#9B98A0]"
              } ${d.isToday ? "cal-today" : ""}`}
            >
              <span className="text-[10px] font-mono uppercase">{d.dayName}</span>
              <span
                className={`text-sm font-bold font-display ${
                  isSelected ? "text-[#FFFFFF]" : "text-[#E5E5E7]"
                }`}
              >
                {d.dayNumber}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  hasEvents
                    ? isSelected
                      ? "bg-[#E0A3AA] shadow-[0_0_6px_rgba(224,163,170,0.7)]"
                      : "bg-[#E0A3AA]/70 shadow-[0_0_4px_rgba(224,163,170,0.4)]"
                    : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Day Activities or Blank Space with ample bottom padding */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel shadow-2xl min-h-fit h-auto flex flex-col justify-center pb-8">
        {dayEvents.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <CalendarIcon className="h-8 w-8 text-[#67646C] mx-auto opacity-40" />
            <p className="text-sm font-mono text-[#9B98A0]">No activity found</p>
            <p className="text-xs text-[#67646C]">
              No events scheduled for {activeDayObj?.dayName}, {activeDayObj?.dateString}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((evt, evtIdx) => (
              <motion.div
                key={evt.id}
                initial={entering ? { y: 14, opacity: 0.35 } : { y: 0, opacity: 1 }}
                animate={
                  entering
                    ? {
                        y: 0,
                        opacity: 1,
                        transition: {
                          duration: 0.26,
                          delay: Math.min(evtIdx * 0.06, 0.3),
                          ease: [0.16, 1, 0.3, 1],
                        },
                      }
                    : { y: 0, opacity: 1 }
                }
                onClick={(e) => {
                  if (!isInteractive) return;
                  e.stopPropagation();
                  onSelectEvent(evt);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 shadow-lg hover:shadow-xl ${
                  evt.id === highlightedEventId
                    ? "bg-[#241416]/90 border-[#E0A3AA] border-t-white/50 ring-2 ring-[#E0A3AA]"
                    : "glass-panel glass-panel-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[#E0A3AA] flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#E0A3AA]" />
                    {evt.time}
                  </span>
                  {evt.id === highlightedEventId && (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#E0A3AA] text-[#0A090A]">
                      Match
                    </span>
                  )}
                </div>

                <h4 className="font-display font-extrabold text-base text-[#E5E5E7]">
                  {evt.title}
                </h4>

                {evt.description && (
                  <p className="text-xs text-[#9B98A0] leading-relaxed">
                    {evt.description}
                  </p>
                )}

                {evt.location && (
                  <div className="flex items-center gap-1.5 text-xs text-[#9B98A0] pt-2 border-t border-[#242021]/80">
                    <MapPin className="h-3.5 w-3.5 text-[#E0A3AA]" />
                    <span>{evt.location}</span>
                  </div>
                )}

                <div className="pt-2 pb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full text-xs bg-[#241416] text-white border-[#5E2C32] hover:bg-[#3D1E22]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={generateGoogleCalendarUrl(evt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <span>Add to Google Calendar</span>
                      <ExternalLink className="h-3.5 w-3.5 text-[#E0A3AA]" />
                    </a>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// Desktop Week View (>= 768px): Compact columns with 75% height cards
const DesktopWeekView = memo(function DesktopWeekView({
  weekDays,
  events,
  highlightedEventId,
  highlightedDateString,
  isInteractive,
  onSelectEvent,
}: {
  weekDays: {
    date: Date;
    dateString: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
  }[];
  events: CalendarEvent[];
  highlightedEventId: string | null;
  highlightedDateString: string | null;
  isInteractive: boolean;
  onSelectEvent: (evt: CalendarEvent) => void;
}) {
  return (
    <div className="hidden md:grid md:grid-cols-7 gap-2.5 w-full select-text">
      {weekDays.map((dayObj) => {
        const dayEvents = events.filter((e) => e.date === dayObj.dateString);
        const isDateSearched = dayObj.dateString === highlightedDateString;

        return (
          <div
            key={dayObj.dateString}
            className={`rounded-2xl border p-2.5 flex flex-col gap-2.5 min-h-[350px] lg:min-h-[380px] transition-all shadow-2xl ${
              isDateSearched
                ? "glass-panel ring-2 ring-[#E0A3AA] border-[#E0A3AA] border-t-[#E0A3AA] shadow-[0_0_18px_rgba(224,163,170,0.35)]"
                : dayObj.isToday
                ? "glass-panel ring-1 ring-[#E0A3AA]/60 border-[#5E2C32] border-t-white/50 shadow-[0_0_14px_rgba(224,163,170,0.15)] cal-today"
                : "glass-cell glass-cell-hover"
            }`}
          >
            <div className="border-b border-[#242021] pb-1.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#9B98A0]">
                  {dayObj.dayName}
                </span>
                <div
                  className={`text-xl lg:text-2xl font-display font-extrabold ${
                    dayObj.isToday ? "text-[#E0A3AA]" : "text-[#E5E5E7]"
                  }`}
                >
                  {dayObj.dayNumber}
                </div>
              </div>
              {dayObj.isToday && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA]">
                  Today
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {dayEvents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-3">
                  <span className="text-xs text-[#67646C] font-mono">No events</span>
                </div>
              ) : (
                dayEvents.map((evt) => {
                  const isHighlighted = evt.id === highlightedEventId;
                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ y: 0, opacity: 1 }}
                      animate={{ y: 0, opacity: 1 }}
                      style={{ willChange: "auto" }}
                      onClick={(e) => {
                        if (!isInteractive) return;
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all min-h-[75%] shadow-lg hover:shadow-xl ${
                        isHighlighted
                          ? "bg-[#241416]/90 border-[#E0A3AA] border-t-white/50 ring-2 ring-[#E0A3AA] shadow-[0_0_20px_rgba(224,163,170,0.5)]"
                          : "glass-chip"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-semibold text-[#E0A3AA] flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#E0A3AA]" />
                            {evt.time}
                          </span>
                          {isHighlighted && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#E0A3AA] text-[#0A090A]">
                              Match
                            </span>
                          )}
                        </div>

                        <h4 className="font-display font-bold text-xs lg:text-sm text-[#E5E5E7] leading-snug">
                          {evt.title}
                        </h4>

                        {evt.description && (
                          <p className="text-xs text-[#9B98A0] leading-relaxed line-clamp-3">
                            {evt.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#9B98A0] pt-1.5 border-t border-[#242021]/80 mt-1.5 truncate">
                        <MapPin className="h-3 w-3 text-[#E0A3AA] shrink-0" />
                        <span className="truncate">{evt.location}</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ==========================================
// MAIN CALENDAR PAGE COMPONENT
// ==========================================

// Bottom edge of the sticky navbar in viewport coordinates. Anything scrolled
// to the top of the list is aligned just below this so it can never end up
// hidden underneath the header.
function getStickyHeaderBottom(): number {
  const header = document.querySelector("header");
  if (!header) return 0;
  return Math.max(0, header.getBoundingClientRect().bottom);
}

export function CalendarPage() {
  // Immediate Data Hydration: zero skeleton flash
  const cachedData = getCachedCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    return cachedData && cachedData.length > 0 ? cachedData : fallbackEvents;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const c = getCachedCalendar();
    return (c && c.length > 0) || fallbackEvents.length > 0 ? false : true;
  });
  const [error, setError] = useState<string | null>(null);

  // Active view mode and date navigation state
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  // List view sort direction: newest-first (default) or oldest-first
  const [listSortNewest, setListSortNewest] = useState<boolean>(true);
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>(TODAY_STRING);
  const [listActiveIndex, setListActiveIndex] = useState<number>(0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  // Arrows scroll the *document* on mobile (the list has no inner scroller).
  // While that smooth scroll animates we pin the intended index so the passive
  // tracker can neither fight it mid-flight nor drag the highlight back when
  // the page is already scrolled as far as it will go.
  const pinnedIndexRef = useRef<number | null>(null);
  const pinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const listSettleTimer = useRef<NodeJS.Timeout | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Mobile detection for list mode: below sm breakpoint we use native scrolling
  // with top-element highlight only (no scroll hijacking / pager lock-in).
  const [isMobileList, setIsMobileList] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobileList(e.matches);
    setIsMobileList(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // List scroll tracker — passive, never scrolls. Promotes the card sitting at
  // the top of the scroll area (bigger + highlighted) so the user always knows
  // where they are.
  //
  // Two deliberate safety measures keep scrolling smooth:
  // 1. It only re-evaluates once the scroll SETTLES. Promoting a card grows it,
  //    which pushes everything below it down — doing that mid-drag would yank
  //    content out from under the user's finger.
  // 2. It stands down while an arrow-driven scroll is pinned.
  const updateListActiveFromScroll = useCallback(() => {
    if (pinnedIndexRef.current !== null) return;
    const container = listContainerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>("[data-event-index]");
    if (items.length === 0) return;
    // Reference line: the container's own top while it sits below the sticky
    // navbar (desktop inner scroller). On mobile the document scrolls and the
    // container top goes negative, so fall back to just under the navbar.
    const line = Math.max(
      container.getBoundingClientRect().top,
      getStickyHeaderBottom() + 12
    );
    let candidate = Number(items[0].getAttribute("data-event-index") ?? 0);
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Last card whose top has crossed just below the reference line = top element
      if (rect.top <= line + 24) {
        candidate = Number(el.getAttribute("data-event-index") ?? candidate);
      }
    });
    setListActiveIndex((prev) => (prev === candidate ? prev : candidate));
  }, []);

  const handleListScroll = useCallback(() => {
    if (listSettleTimer.current) clearTimeout(listSettleTimer.current);
    listSettleTimer.current = setTimeout(() => {
      listSettleTimer.current = null;
      updateListActiveFromScroll();
    }, 110);
  }, [updateListActiveFromScroll]);

  // Track whether there is enough space on either side of the viewport for the floating nav arrows
  const [hasSideSpace, setHasSideSpace] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const check = () => {
      const rect = el.getBoundingClientRect();
      // Show side buttons when there are at least 52px of gutter on each side
      setHasSideSpace(rect.left >= 52 && window.innerWidth - rect.right >= 52);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(document.documentElement);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  // Bring a list card to the top of the scroll area.
  // - Desktop: the list is an inner scroller, so scroll that container.
  // - Mobile: the document is the scroller, so scroll the window until the card
  //   sits just clear of the sticky navbar. The index is pinned for the length
  //   of the animation so the passive tracker cannot hijack the highlight.
  const scrollEventToTop = useCallback(
    (index: number) => {
      const container = listContainerRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-event-index="${index}"]`);
      if (!el) return;

      if (isMobileList) {
        // The document is the scroller on mobile, so only record the intent
        // here. The actual scroll runs in the effect below, AFTER React has
        // committed the new top card — promoting a card resizes it and
        // collapses the previous one, so measuring at click time would aim at a
        // position that no longer exists once the layout settles.
        pinnedIndexRef.current = index;
        if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
        pinTimerRef.current = setTimeout(() => {
          pinnedIndexRef.current = null;
          pinTimerRef.current = null;
        }, 700);
        return;
      }

      const topOffset = el.offsetTop - container.offsetTop;
      container.scrollTo({
        top: Math.max(0, topOffset),
        behavior: "smooth",
      });
    },
    [isMobileList]
  );

  // Performs the arrow / Today jump on mobile once the new top card has been
  // committed to the DOM, so the measurement reflects the settled layout.
  useEffect(() => {
    if (!isMobileList) return;
    const pinned = pinnedIndexRef.current;
    if (pinned === null) return;
    const el = listContainerRef.current?.querySelector<HTMLElement>(
      `[data-event-index="${pinned}"]`
    );
    if (!el) return;
    const navBottom = getStickyHeaderBottom();
    window.scrollTo({
      top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - navBottom - 12),
      behavior: "smooth",
    });
  }, [listActiveIndex, isMobileList]);

  // On mobile the document is the scroller, so track scroll there instead of on
  // the list container (passive + debounced, so it costs nothing per frame).
  useEffect(() => {
    if (!isMobileList || viewMode !== "list") return;
    window.addEventListener("scroll", handleListScroll, { passive: true });
    // A touch/wheel means the user has taken over — drop any arrow pin.
    const releasePin = () => {
      pinnedIndexRef.current = null;
    };
    window.addEventListener("touchstart", releasePin, { passive: true });
    window.addEventListener("wheel", releasePin, { passive: true });
    // Entering list mode or rotating the device can leave the highlight on a
    // card that is no longer at the top; re-derive it once the mode transition
    // and layout have settled.
    const settle = setTimeout(updateListActiveFromScroll, 340);
    return () => {
      window.removeEventListener("scroll", handleListScroll);
      window.removeEventListener("touchstart", releasePin);
      window.removeEventListener("wheel", releasePin);
      clearTimeout(settle);
    };
  }, [isMobileList, viewMode, handleListScroll, updateListActiveFromScroll]);

  // Transition state: activates the cylindrical ring display during arrow navigation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Month ⇄ Week ⇄ List mode transition state ("deck of cards" unfold / fold)
  const [modeTransition, setModeTransition] = useState<
    "month" | "week-fold" | "week" | "week-shrink" | "list" | null
  >(null);
  const [modeAnchorWeek, setModeAnchorWeek] = useState<string | null>(null);
  const modeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearModeTimer = useCallback(() => {
    if (modeTimerRef.current) {
      clearTimeout(modeTimerRef.current);
      modeTimerRef.current = null;
    }
  }, []);

  const notifyAnimationStart = useCallback(() => {
    window.dispatchEvent(new CustomEvent("calendar:transition-start"));
  }, []);

  const notifyAnimationComplete = useCallback(() => {
    window.dispatchEvent(new CustomEvent("calendar:transition-end"));
  }, []);

  const triggerTransition = useCallback(() => {
    notifyAnimationStart();
    setIsTransitioning(true);
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      notifyAnimationComplete();
    }, 550);
  }, [notifyAnimationStart, notifyAnimationComplete]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
      }
      notifyAnimationComplete();
    };
  }, [notifyAnimationComplete]);

  // When switching to list view, reset to the first event
  useEffect(() => {
    if (viewMode === "list") {
      setListActiveIndex(0);
    }
  }, [viewMode]);


  // Search & Database lookup state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [highlightedDateString, setHighlightedDateString] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Unified event selection handler: opens details and syncs active day
  const handleSelectEvent = useCallback((evt: CalendarEvent) => {
    setSelectedEvent(evt);
    setMobileSelectedDay(evt.date);
  }, []);

  // Compute active week selected day cleanly without cascade re-render overwrites
  const currentWeekSelectedDay = useMemo(() => {
    const weekDate = getDateForWeek(activeIndex);
    const { weekDays } = getWeekData(weekDate);

    if (highlightedDateString && weekDays.some((d) => d.dateString === highlightedDateString)) {
      return highlightedDateString;
    }
    if (mobileSelectedDay && weekDays.some((d) => d.dateString === mobileSelectedDay)) {
      return mobileSelectedDay;
    }
    const dayWithEvent = weekDays.find((d) => events.some((e) => e.date === d.dateString));
    if (dayWithEvent) return dayWithEvent.dateString;
    const todayMatch = weekDays.find((d) => d.isToday);
    if (todayMatch) return todayMatch.dateString;
    return weekDays[0]?.dateString || "";
  }, [activeIndex, highlightedDateString, mobileSelectedDay, events]);

  // Filtered & Sorted events for list view and search
  const filteredListEvents = useMemo(() => {
    let result = [...events];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const parsed = parseSearchDate(q);
      const parsedDateStr = parsed
        ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
        : null;

      result = result.filter((evt) => {
        if (parsedDateStr && evt.date === parsedDateStr) return true;
        if (evt.title.toLowerCase().includes(q)) return true;
        if (evt.description.toLowerCase().includes(q)) return true;
        if (evt.location.toLowerCase().includes(q)) return true;
        if (evt.category && evt.category.toLowerCase().includes(q)) return true;
        if (evt.date.includes(q)) return true;
        return false;
      });
    }

    result.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return listSortNewest ? db - da : da - db;
    });

    return result;
  }, [events, searchQuery, listSortNewest]);

  // Fetch data: strictly from public.events table
  const fetchEvents = useCallback(async () => {
    setError(null);
    try {
      const data = await prefetchCalendar();
      setEvents(data);
    } catch (err: unknown) {
      console.error("Failed to load events:", err);
      setError("Unable to connect to events database. Showing local offline schedule.");
      setEvents(fallbackEvents);
    } finally {
      setLoading(false);
    }
  }, []);

  // Supabase Realtime synchronization: strictly public.events
  // Deferred — realtime client loads after mount so it never blocks LCP.
  useEffect(() => {
    let isMounted = true;
    fetchEvents();

    let channel: any = null;
    let supabaseClient: any = null;
    if (isSupabaseConfigured) {
      import("@/lib/supabaseLazy").then(({ supabase }) => {
        if (!isMounted || !supabase) return;
        supabaseClient = supabase;
        channel = supabase
          .channel("realtime-events-only")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "events" },
            () => {
              if (isMounted) {
                fetchEvents();
              }
            }
          )
          .subscribe();
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, [fetchEvents]);

  // Modal ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedEvent(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live Database Search: prioritizes title over description/location, and supports searching specific dates
  const performDatabaseSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) {
        setHighlightedEventId(null);
        setHighlightedDateString(null);
        return;
      }

      setIsSearching(true);
      try {
        // 1. Check if user typed a specific day/date (e.g. "Sep 15", "15th", "9/15", "Oct 3")
        const parsedDate = parseSearchDate(q);
        if (parsedDate) {
          const diffTime = parsedDate.getTime() - new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0).getTime();
          const targetWeekIndex = Math.round(diffTime / (7 * 86400000));
          const targetMonthIndex =
            (parsedDate.getFullYear() - TODAY_YEAR) * 12 + (parsedDate.getMonth() - TODAY_MONTH);

          const y = parsedDate.getFullYear();
          const m = String(parsedDate.getMonth() + 1).padStart(2, "0");
          const d = String(parsedDate.getDate()).padStart(2, "0");
          const targetDateString = `${y}-${m}-${d}`;

          if (viewMode === "list") {
            const matchIdx = filteredListEvents.findIndex((e) => e.date === targetDateString);
            if (matchIdx !== -1) {
              setListActiveIndex(matchIdx);
              const el = document.querySelector(`[data-event-index="${matchIdx}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          } else {
            triggerTransition();
            if (viewMode === "week") {
              setActiveIndex(targetWeekIndex);
            } else {
              setActiveIndex(targetMonthIndex);
            }
          }

          setHighlightedDateString(targetDateString);
          setMobileSelectedDay(targetDateString);

          const eventOnDay = events.find((e) => e.date === targetDateString);
          setHighlightedEventId(eventOnDay ? eventOnDay.id : null);
          return;
        }

        // 2. Keyword Search prioritizing TITLE over description/location/category
        // Single round-trip: one OR query ordered so title matches sort first.
        // Title rows are preferred client-side — avoids the old sequential
        // title-then-description chain that doubled search latency.
        let matched: CalendarEvent | null = null;

        if (isSupabaseConfigured) {
          try {
            const { supabase } = await import("@/lib/supabaseLazy");
            if (supabase) {
              const { data } = await supabase
                .from("events")
                .select("id,title,date,time,location,description,category")
                .or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%,category.ilike.%${q}%`)
                .order("date", { ascending: true })
                .limit(10);

              if (data && data.length > 0) {
                const lowerQ = q.toLowerCase();
                matched =
                  data.find((row) => (row.title as string).toLowerCase().includes(lowerQ)) ||
                  data[0];
              }
            }
          } catch {
            // Fall through to the local array search below
          }
        }

        // Local array fallback
        if (!matched) {
          const lowerQ = q.toLowerCase();
          matched = events.find((evt) => evt.title.toLowerCase().includes(lowerQ)) || null;

          if (!matched) {
            matched =
              events.find(
                (evt) =>
                  evt.description.toLowerCase().includes(lowerQ) ||
                  evt.location.toLowerCase().includes(lowerQ) ||
                  (evt.category && evt.category.toLowerCase().includes(lowerQ)) ||
                  evt.date.includes(lowerQ)
              ) || null;
          }
        }

        // 3. If a match is found: navigate to its date and highlight it
        if (matched) {
          const [y, m, d] = matched.date.split("-").map(Number);
          const targetDate = new Date(y, m - 1, d, 12, 0, 0);
          const diffTime = targetDate.getTime() - new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0).getTime();
          const targetWeekIndex = Math.round(diffTime / (7 * 86400000));
          const targetMonthIndex = (y - TODAY_YEAR) * 12 + (m - 1 - TODAY_MONTH);

          if (viewMode === "list") {
            const matchIdx = filteredListEvents.findIndex((e) => e.id === matched!.id);
            if (matchIdx !== -1) {
              setListActiveIndex(matchIdx);
              const el = document.querySelector(`[data-event-index="${matchIdx}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          } else {
            triggerTransition();
            if (viewMode === "week") {
              setActiveIndex(targetWeekIndex);
            } else {
              setActiveIndex(targetMonthIndex);
            }
          }

          setHighlightedEventId(matched.id);
          setHighlightedDateString(matched.date);
          setMobileSelectedDay(matched.date);
        } else {
          setHighlightedEventId(null);
          setHighlightedDateString(null);
        }
      } catch (err) {
        console.error("Database search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [events, viewMode, filteredListEvents, triggerTransition]
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performDatabaseSearch(searchQuery);
      } else {
        setHighlightedEventId(null);
        setHighlightedDateString(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, performDatabaseSearch]);

  // Google Calendar URL Generator
  const generateGoogleCalendarUrl = useCallback((evt: CalendarEvent) => {
    const formattedDate = evt.date.replace(/-/g, "");
    const formattedTime = evt.time.replace(":", "") + "00";
    const startIso = `${formattedDate}T${formattedTime}Z`;
    const endHour = (parseInt(evt.time.split(":")[0], 10) + 1).toString().padStart(2, "0");
    const endMinute = evt.time.split(":")[1] || "00";
    const endIso = `${formattedDate}T${endHour}${endMinute}00Z`;

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: evt.title,
      dates: `${startIso}/${endIso}`,
      details: evt.description,
      location: evt.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, []);

  // Stepper handlers
  const handlePrev = useCallback(() => {
    if (viewMode === "list") {
      setListActiveIndex((prev) => {
        const next = Math.max(0, prev - 1);
        scrollEventToTop(next);
        return next;
      });
      return;
    }
    triggerTransition();
    setActiveIndex((prev) => prev - 1);
  }, [viewMode, triggerTransition, scrollEventToTop]);

  const handleNext = useCallback(() => {
    if (viewMode === "list") {
      setListActiveIndex((prev) => {
        const maxIdx = Math.max(0, filteredListEvents.length - 1);
        const next = Math.min(maxIdx, prev + 1);
        scrollEventToTop(next);
        return next;
      });
      return;
    }
    triggerTransition();
    setActiveIndex((prev) => prev + 1);
  }, [viewMode, filteredListEvents.length, triggerTransition, scrollEventToTop]);

  const handleToday = useCallback(() => {
    if (viewMode === "list") {
      if (filteredListEvents.length === 0) return;
      const todayTime = new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0).getTime();
      let bestIdx = 0;
      let bestDiff = Infinity;
      filteredListEvents.forEach((evt, idx) => {
        const [y, m, d] = evt.date.split("-").map(Number);
        const diff = Math.abs(new Date(y, m - 1, d, 12, 0, 0).getTime() - todayTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      });
      setListActiveIndex(bestIdx);
      scrollEventToTop(bestIdx);
      return;
    }
    if (activeIndex === 0) return;
    triggerTransition();
    setActiveIndex(0);
  }, [viewMode, activeIndex, filteredListEvents, triggerTransition, scrollEventToTop]);

  // Swipe gestures for all devices (touch, mouse drag, trackpad)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (viewMode === "list") return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        if (deltaX < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    },
    [viewMode, handleNext, handlePrev]
  );

  const handlePanEnd = useCallback(
    (_e: any, info: { offset: { x: number; y: number } }) => {
      if (viewMode === "list") return;
      if (Math.abs(info.offset.x) > 45 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.3) {
        if (info.offset.x < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    },
    [viewMode, handleNext, handlePrev]
  );

  // Desktop Mouse Wheel navigation: scrolling changes week/month
  const lastWheelTime = useRef<number>(0);

  // Non-passive native wheel listener: completely prevents window scrolling while interacting with the calendar
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (viewMode === "list") return; // List view handles its own internal snapping scroll

      // Stop page from scrolling while scrolling the calendar
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastWheelTime.current < 320) return;

      if (Math.abs(e.deltaY) > 15 || Math.abs(e.deltaX) > 15) {
        lastWheelTime.current = now;
        if (e.deltaY > 15 || e.deltaX > 15) {
          handleNext();
        } else if (e.deltaY < -15 || e.deltaX < -15) {
          handlePrev();
        }
      }
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
    };
  }, [viewMode, handleNext, handlePrev]);

  // List wheel handler: accumulated-delta pager — each 80px of scroll = one event advance.
  // A fast flick accumulates quickly and advances multiple events naturally.
  const listWheelAccum = useRef<number>(0);
  const listWheelDecayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listTouchStartY = useRef<number | null>(null);
  const WHEEL_STEP = 80; // px of accumulated deltaY per event advance

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el || viewMode !== "list") return;
    if (isMobileList) return; // Mobile: native scrolling, no wheel hijacking

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Accumulate normalized delta (cap single-event delta to avoid huge trackpad jumps)
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120);
      listWheelAccum.current += delta;

      // Fire an advance for each WHEEL_STEP crossed
      while (Math.abs(listWheelAccum.current) >= WHEEL_STEP) {
        if (listWheelAccum.current > 0) {
          handleNext();
          listWheelAccum.current -= WHEEL_STEP;
        } else {
          handlePrev();
          listWheelAccum.current += WHEEL_STEP;
        }
      }

      // Decay accumulator after gesture ends so leftover delta doesn't carry over
      if (listWheelDecayTimer.current) clearTimeout(listWheelDecayTimer.current);
      listWheelDecayTimer.current = setTimeout(() => {
        listWheelAccum.current = 0;
      }, 150);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (listWheelDecayTimer.current) clearTimeout(listWheelDecayTimer.current);
    };
  }, [viewMode, handleNext, handlePrev, isMobileList]);

  // Touch swipe on list container — desktop pager only; mobile uses native scroll
  const handleListTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isMobileList) return;
      listTouchStartY.current = e.touches[0].clientY;
    },
    [isMobileList]
  );

  const handleListTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isMobileList) return;
    if (listTouchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - listTouchStartY.current;
    listTouchStartY.current = null;
    if (Math.abs(deltaY) < 40) return;
    if (deltaY < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  }, [handleNext, handlePrev, isMobileList]);

  // View switch handler — symmetrical multi-phase transitions
  const handleViewToggle = useCallback(
    (newMode: "month" | "week" | "list") => {
      if (newMode === viewMode && modeTransition === null) return;
      notifyAnimationStart();
      clearModeTimer();

      if (newMode === "list") {
        setModeTransition("list");
        setViewMode("list");
        setListActiveIndex(0);
        modeTimerRef.current = setTimeout(() => {
          setModeTransition(null);
          notifyAnimationComplete();
        }, 320);
        return;
      }

      if (newMode === "week") {
        if (viewMode === "list" || viewMode === "month") {
          setModeTransition("week-fold");
          modeTimerRef.current = setTimeout(() => {
            clearModeTimer();
            let diffWeeks = 0;
            if (viewMode === "month") {
              const monthDate = getDateForMonth(activeIndex);
              const targetDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), TODAY_DAY, 12, 0, 0);
              diffWeeks = Math.round(
                (targetDate.getTime() - new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0).getTime()) / (7 * 86400000)
              );
            } else if (viewMode === "list") {
              const activeEvt = filteredListEvents[listActiveIndex] || events[0];
              if (activeEvt) {
                const [y, m, d] = activeEvt.date.split("-").map(Number);
                const targetDate = new Date(y, m - 1, d, 12, 0, 0);
                diffWeeks = Math.round(
                  (targetDate.getTime() - new Date(TODAY_YEAR, TODAY_MONTH, TODAY_DAY, 12, 0, 0).getTime()) / (7 * 86400000)
                );
                setMobileSelectedDay(activeEvt.date);
              }
            }
            setActiveIndex(diffWeeks);
            setViewMode("week");
            setModeTransition("week");
            modeTimerRef.current = setTimeout(() => {
              setModeTransition(null);
              notifyAnimationComplete();
            }, MODE_WEEK_SETTLE_MS);
          }, MODE_FOLD_MS);
          return;
        }
        setModeTransition("week");
        modeTimerRef.current = setTimeout(() => {
          setModeTransition(null);
          notifyAnimationComplete();
        }, MODE_WEEK_SETTLE_MS);
        return;
      }

      // newMode === "month"
      if (viewMode === "week" || viewMode === "list") {
        setModeTransition("week-shrink");
        modeTimerRef.current = setTimeout(() => {
          clearModeTimer();
          let diffMonths = 0;
          if (viewMode === "week") {
            const weekDate = getDateForWeek(activeIndex);
            setModeAnchorWeek(getWeekData(weekDate).weekDays[0].dateString);
            diffMonths = (weekDate.getFullYear() - TODAY_YEAR) * 12 + (weekDate.getMonth() - TODAY_MONTH);
          } else if (viewMode === "list") {
            const activeEvt = filteredListEvents[listActiveIndex] || events[0];
            if (activeEvt) {
              const [y, m, _d] = activeEvt.date.split("-").map(Number);
              diffMonths = (y - TODAY_YEAR) * 12 + (m - 1 - TODAY_MONTH);
              setMobileSelectedDay(activeEvt.date);
            }
            setModeAnchorWeek(null);
          }
          setActiveIndex(diffMonths);
          setViewMode("month");
          setModeTransition("month");
          modeTimerRef.current = setTimeout(() => {
            setModeTransition(null);
            notifyAnimationComplete();
          }, MODE_UNFOLD_MS);
        }, MODE_FOLD_MS);
        return;
      }

      setModeTransition("month");
      modeTimerRef.current = setTimeout(() => {
        setModeTransition(null);
        notifyAnimationComplete();
      }, MODE_UNFOLD_MS);
    },
    [
      viewMode,
      modeTransition,
      activeIndex,
      filteredListEvents,
      listActiveIndex,
      events,
      notifyAnimationStart,
      notifyAnimationComplete,
      clearModeTimer,
    ]
  );

  // Active period title: in list mode, shows formatted day of the active event
  const activeTitle = useMemo(() => {
    if (viewMode === "list") {
      if (filteredListEvents.length === 0) {
        return searchQuery ? "No Matches" : "No Events";
      }
      const safeIdx = Math.min(listActiveIndex, filteredListEvents.length - 1);
      const activeEvt = filteredListEvents[safeIdx];
      if (!activeEvt) return "No Events";
      const [y, m, d] = activeEvt.date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d, 12, 0, 0);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(dateObj);
    } else if (viewMode === "month") {
      return getMonthData(getDateForMonth(activeIndex)).monthTitle;
    } else {
      return getWeekData(getDateForWeek(activeIndex)).weekTitle;
    }
  }, [viewMode, activeIndex, filteredListEvents, listActiveIndex, searchQuery]);

  // Dedicated List View Content Renderer:
  // - Desktop: Pager mode — renders events from listActiveIndex onward,
  //   no internal scrolling. Scroll/touch on the container advances the pager.
  // - Mobile (<=640px): native smooth scrolling — renders ALL events, no
  //   AnimatePresence / layout animations / scroll hijacking. The topmost
  //   visible card is rendered bigger + highlighted via the passive
  //   handleListScroll tracker (rAF-throttled, never scrolls programmatically).
  const renderListContent = useCallback(() => {
    // ---- Mobile: lightweight native-scroll list, zero lock-in ----
    if (isMobileList) {
      return (
        // The ref is required here too: the arrow steppers and the Today jump
        // resolve their target card through this container on mobile.
        <div ref={listContainerRef} className="flex flex-col gap-4 pb-6">
          {filteredListEvents.map((evt, evtIdx) => {
            const isTop = evtIdx === listActiveIndex;
            const isHighlighted = evt.id === highlightedEventId;
            const showDateHeader =
              evtIdx === 0 || filteredListEvents[evtIdx - 1]?.date !== evt.date;
            return (
              <div key={evt.id} data-event-index={evtIdx}>
                {showDateHeader && (
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <span
                      className={`text-xs font-mono font-bold uppercase tracking-widest ${
                        isTop ? "text-[#E8959C]" : "text-[#9B98A0]"
                      }`}
                    >
                      {evt.date}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-[#E0A3AA]/30 to-transparent" />
                  </div>
                )}
                <article
                  onClick={() => {
                    setListActiveIndex(evtIdx);
                    handleSelectEvent(evt);
                  }}
                  className={`relative rounded-2xl border text-left w-full overflow-hidden cursor-pointer ${
                    isTop || isHighlighted
                      ? "p-5 border-[#E0A3AA]/60 bg-gradient-to-br from-[#1A1A1E] to-[#121215] shadow-[0_0_40px_-8px_rgba(224,163,170,0.35)]"
                      : "p-4 border-white/10 bg-[#121215]/80"
                  }`}
                >
                  {isHighlighted && !isTop && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-[#E0A3AA]" />
                  )}
                  {isTop && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#E0A3AA] to-transparent" />
                  )}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className={`font-display font-bold leading-tight flex-1 ${
                          isTop ? "text-lg text-white" : "text-[15px] text-[#EDEDEF]"
                        }`}
                      >
                        {evt.title}
                        {isHighlighted && searchQuery && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-[#E0A3AA]/15 border border-[#E0A3AA]/40 px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider text-[#E0A3AA] align-middle">
                            Match
                          </span>
                        )}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-mono font-bold whitespace-nowrap ${
                          isTop
                            ? "text-[#E0A3AA] border-[#E0A3AA]/30 bg-[#E0A3AA]/10"
                            : "text-[#9B98A0] border-white/10 bg-white/5"
                        }`}
                      >
                        {evt.time}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#9B98A0] flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-[#9B98A0] shrink-0" />
                      <span className="truncate">{evt.location}</span>
                    </p>
                    {isTop && evt.description && (
                      <p className="text-[13px] text-[#C9C7CE] leading-relaxed line-clamp-3">
                        {evt.description}
                      </p>
                    )}
                    {evt.category ? (
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold ${
                            isTop
                              ? "text-[#E0A3AA] border-[#E0A3AA]/25 bg-[#E0A3AA]/10"
                              : "text-[#9B98A0] border-white/10 bg-white/5"
                          }`}
                        >
                          {evt.category}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      );
    }

    // ---- Desktop: pager with depth stack ----
    // Events visible in the pager: from listActiveIndex to end
    const visibleEvents = filteredListEvents.slice(listActiveIndex);

    return (
      <div
        ref={listContainerRef}
        onTouchStart={handleListTouchStart}
        onTouchEnd={handleListTouchEnd}
        onScroll={isMobileList ? handleListScroll : undefined}
        className={
          isMobileList
            ? "flex flex-col gap-3.5 select-text w-full overflow-y-auto overscroll-contain max-h-[calc(100dvh-13.5rem)] min-h-[420px] pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]"
            : "flex flex-col gap-3.5 select-text w-full overflow-hidden max-h-[calc(100dvh-13.5rem)] min-h-[420px] pr-1"
        }
        style={isMobileList ? undefined : { scrollbarWidth: "none" }}
      >
        {filteredListEvents.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl border border-[#242021] bg-[#141213] space-y-3">
            <CalendarIcon className="h-10 w-10 text-[#67646C] mx-auto opacity-40" />
            <p className="text-base font-display font-bold text-[#E5E5E7]">
              {searchQuery ? `No events matching "${searchQuery}"` : "No events scheduled"}
            </p>
            {searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs text-[#E0A3AA] border-[#5E2C32] hover:bg-[#241416]"
              >
                Clear Search
              </Button>
            ) : (
              <p className="text-xs font-mono text-[#9B98A0]">Check back later for new events</p>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleEvents.map((evt, visIdx) => {
              const evtIdx = listActiveIndex + visIdx;
              const isTop = visIdx === 0;
              const isHighlighted = evt.id === highlightedEventId;

              if (isTop) {
                return (
                  <motion.div
                    key={evt.id}
                    layout
                    data-event-item
                    data-event-index={evtIdx}
                    initial={{ opacity: 0, y: -24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -60, scale: 0.94, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                    transition={{
                      layout: { type: "spring", stiffness: 320, damping: 28 },
                      opacity: { duration: 0.18 },
                      y: { type: "spring", stiffness: 320, damping: 28 },
                    }}
                    onClick={() => handleSelectEvent(evt)}
                    className="p-5 sm:p-6 rounded-2xl border cursor-pointer space-y-3.5 shadow-2xl relative overflow-hidden glass-panel border-[#E0A3AA] border-t-white/60 ring-2 ring-[#E0A3AA]/70 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_28px_rgba(224,163,170,0.25)] shrink-0 hover:border-t-white/80 transition-all bg-gradient-to-br from-[#2D1619]/60 via-white/[0.05] to-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E0A3AA] text-[#141213] flex items-center gap-1 shadow-sm">
                          <CalendarIcon className="h-3 w-3" />
                          Current Event
                        </span>
                        {evt.category && (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA]">
                            {evt.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-[#E0A3AA]">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CalendarIcon className="h-3.5 w-3.5 text-[#E0A3AA]" />
                          {evt.date}
                        </span>
                        <span className="flex items-center gap-1 text-[#9B98A0]">
                          <Clock className="h-3.5 w-3.5 text-[#9B98A0]" />
                          {evt.time}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display font-black text-lg sm:text-xl md:text-2xl text-[#FFFFFF] leading-snug tracking-tight">
                      {evt.title}
                    </h3>

                    {evt.description && (
                      <p className="text-xs sm:text-sm text-[#D1D0D5] leading-relaxed">
                        {evt.description}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#382D30]/80">
                      {evt.location ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#9B98A0] truncate">
                          <MapPin className="h-3.5 w-3.5 text-[#E0A3AA]" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="text-xs bg-[#241416] text-white border-[#5E2C32] hover:bg-[#3D1E22] h-8 px-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={generateGoogleCalendarUrl(evt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5"
                          >
                            <span>Add to Google Calendar</span>
                            <ExternalLink className="h-3 w-3 text-[#E0A3AA]" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={evt.id}
                  layout
                  data-event-item
                  data-event-index={evtIdx}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: visIdx <= 2 ? 1 - visIdx * 0.12 : 0.65, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    layout: { type: "spring", stiffness: 320, damping: 28 },
                    opacity: { duration: 0.2 },
                  }}
                  onClick={() => {
                    setListActiveIndex(evtIdx);
                    handleSelectEvent(evt);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer space-y-2.5 shrink-0 transition-all ${
                    isHighlighted
                      ? "glass-panel ring-2 ring-[#E0A3AA] border-[#E0A3AA] border-t-white/50"
                      : "glass-panel glass-panel-hover"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-[#E0A3AA] flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-[#E0A3AA]" />
                      {evt.date}
                    </span>
                    <span className="text-xs font-mono text-[#9B98A0] flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#9B98A0]" />
                      {evt.time}
                    </span>
                  </div>
                  <h4 className="font-display font-extrabold text-sm sm:text-base text-[#E5E5E7] leading-snug">
                    {evt.title}
                  </h4>
                  {evt.description && (
                    <p className="text-xs text-[#9B98A0] leading-relaxed line-clamp-2">
                      {evt.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#242021]/80">
                    {evt.location ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#9B98A0] truncate">
                        <MapPin className="h-3.5 w-3.5 text-[#E0A3AA]" />
                        <span className="truncate">{evt.location}</span>
                      </div>
                    ) : (
                      <span />
                    )}
                    {evt.category && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA] shrink-0">
                        {evt.category}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    );
  }, [
    filteredListEvents,
    listActiveIndex,
    highlightedEventId,
    searchQuery,
    isMobileList,
    handleListScroll,
    generateGoogleCalendarUrl,
    handleListTouchStart,
    handleListTouchEnd,
    handleSelectEvent,
  ]);

  // Cleanup pending scroll timers on unmount
  useEffect(() => {
    return () => {
      if (listSettleTimer.current) {
        clearTimeout(listSettleTimer.current);
        listSettleTimer.current = null;
      }
      if (pinTimerRef.current) {
        clearTimeout(pinTimerRef.current);
        pinTimerRef.current = null;
      }
    };
  }, []);

  // Render content helper for Month or Week view for any period index
  const renderCalendarContent = useCallback(
    (itemIndex: number, isInteractive: boolean) => {
      const isCenter = isInteractive && itemIndex === activeIndex;
      const enteringMonth = isCenter && modeTransition === "month";
      const foldingMonth = isCenter && (modeTransition === "week-fold" || modeTransition === "week-shrink");
      const enteringWeek = isCenter && modeTransition === "week";

      if (viewMode === "list") {
        return renderListContent();
      }

      if (viewMode === "month") {
        const monthDate = getDateForMonth(itemIndex);
        const { monthDays } = getMonthData(monthDate);
        const weeks = chunkCalendarDays(monthDays, 7);
        const rowHeight = enteringMonth || foldingMonth ? getMonthRowHeightPx() : 0;
        const anchorDateString = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-13`;
        const activeRow =
          enteringMonth
            ? resolveActiveRow(weeks, modeAnchorWeek)
            : foldingMonth
            ? Math.max(0, weeks.findIndex((week) => week.some((d) => d.dateString === anchorDateString)))
            : 0;

        // For plain month-to-month navigation (no mode switch), animate the
        // entire grid as ONE unit — a single compositor layer the GPU translates
        // once instead of 35 separate animation pipelines.
        const isNavEntering = !enteringMonth && !foldingMonth && isCenter;

        return (
          <div className="space-y-1.5 select-text max-w-4xl mx-auto w-full">
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center py-1 md:py-1.5 border-b border-[#242021]/80">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span
                  key={day}
                  className="text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider text-[#9B98A0]"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Week rows — fan out of / fold back into the active week during mode switch.
                During normal month navigation: the whole grid moves as one layer. */}
            <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
              {weeks.map((week, rowIndex) => {
                const delta = activeRow - rowIndex;
                const isActiveRow = rowIndex === activeRow;
                return (
                  <motion.div
                    key={week[0].dateString}
                    initial={
                      enteringMonth
                        ? { y: delta * rowHeight, opacity: isActiveRow ? 0.45 : 0.08 }
                        : { y: 0, opacity: 1 }
                    }
                    animate={
                      enteringMonth
                        ? {
                            y: 0,
                            opacity: 1,
                            transition: {
                              duration: isActiveRow ? 0.2 : 0.36,
                              delay: Math.abs(delta) * 0.05,
                              ease: [0.16, 1, 0.3, 1],
                            },
                          }
                        : foldingMonth
                        ? {
                            y: delta * rowHeight,
                            opacity: 0,
                            transition: {
                              duration: 0.22,
                              delay: Math.abs(delta) * 0.03,
                              ease: [0.7, 0, 0.85, 0.36],
                            },
                          }
                        : { y: 0, opacity: 1 }
                    }
                    style={isNavEntering ? undefined : { willChange: "transform, opacity" }}
                    className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2"
                  >
                    {week.map((dayObj, idx) => {
                      const dayEvents = events.filter((e) => e.date === dayObj.dateString);
                      return (
                        <MonthDayCell
                          key={`${dayObj.dateString}-${idx}`}
                          dayObj={dayObj}
                          dayEvents={dayEvents}
                          highlightedEventId={highlightedEventId}
                          highlightedDateString={highlightedDateString}
                          isInteractive={isInteractive}
                          onSelectEvent={handleSelectEvent}
                          entering={false}
                        />
                      );
                    })}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      }

      const weekDate = getDateForWeek(itemIndex);
      const { weekDays } = getWeekData(weekDate);
      const isActiveWeek = itemIndex === activeIndex;

      return (
        <>
          {/* Mobile View: Horizontal day strip + Full view activity */}
          <MobileWeekView
            weekDays={weekDays}
            events={events}
            highlightedEventId={highlightedEventId}
            highlightedDateString={highlightedDateString}
            isInteractive={isInteractive}
            onSelectEvent={handleSelectEvent}
            generateGoogleCalendarUrl={generateGoogleCalendarUrl}
            entering={enteringWeek}
            selectedDayString={isActiveWeek ? currentWeekSelectedDay : undefined}
            onSelectDay={isActiveWeek && isInteractive ? setMobileSelectedDay : undefined}
          />

          {/* Desktop View: Compact 7-column grid */}
          <DesktopWeekView
            weekDays={weekDays}
            events={events}
            highlightedEventId={highlightedEventId}
            highlightedDateString={highlightedDateString}
            isInteractive={isInteractive}
            onSelectEvent={handleSelectEvent}
          />
        </>
      );
    },
    [
      viewMode,
      activeIndex,
      events,
      highlightedEventId,
      highlightedDateString,
      generateGoogleCalendarUrl,
      modeTransition,
      modeAnchorWeek,
      listSortNewest,
      renderListContent,
      currentWeekSelectedDay,
      handleSelectEvent,
    ]
  );

  // Only display Skeleton if cached data is null/empty and network is actively loading
  if (loading && events.length === 0) {
    return <CalendarSkeleton />;
  }

  return (
    <div
      data-page="calendar"
      className="space-y-3 py-2 sm:py-3 mx-auto w-full max-w-5xl lg:max-w-6xl select-none"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-[#E5E5E7]">
          Event Calendar
        </h1>
      </div>

      {/* Offline Alert Banner */}
      {error && (
        <div className="rounded-xl border border-[#5E2C32] bg-[#241416]/60 p-3 flex items-center justify-between text-xs text-[#E0A3AA]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#E0A3AA]" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchEvents()}
            className="text-xs text-[#E0A3AA] hover:bg-[#3D1E22] shrink-0 h-7 px-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Top Toolbar: Live Search, View Toggle, and Date Steppers */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-2.5 rounded-2xl glass-panel shadow-xl">
        {/* Live Database Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#67646C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search event title or day (e.g. 'Workshop', 'Sep 15', '22')..."
            className="w-full pl-9 pr-9 py-1.5 text-xs glass-cell rounded-full text-[#E5E5E7] placeholder:text-[#67646C] focus:outline-none focus:border-[#E0A3AA] focus:ring-1 focus:ring-[#E0A3AA] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#67646C] hover:text-[#E5E5E7]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isSearching && (
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#E0A3AA]">
              searching...
            </span>
          )}
        </div>

        {/* View Switcher & Date Controls */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 flex-wrap">
          {/* View Mode Switcher (Triggers Depth Zoom Parallax Dive) */}
          <div className="flex items-center p-1 rounded-full glass-cell shadow-inner">
            <button
              onClick={() => handleViewToggle("month")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all ${
                viewMode === "month"
                  ? "bg-[#241416] text-[#E0A3AA] font-bold shadow-sm border border-[#5E2C32] border-t-white/30"
                  : "text-[#9B98A0] hover:text-[#E5E5E7]"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => handleViewToggle("week")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all ${
                viewMode === "week"
                  ? "bg-[#241416] text-[#E0A3AA] font-bold shadow-sm border border-[#5E2C32] border-t-white/30"
                  : "text-[#9B98A0] hover:text-[#E5E5E7]"
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Week</span>
            </button>
            <button
              onClick={() => handleViewToggle("list")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all ${
                viewMode === "list"
                  ? "bg-[#241416] text-[#E0A3AA] font-bold shadow-sm border border-[#5E2C32] border-t-white/30"
                  : "text-[#9B98A0] hover:text-[#E5E5E7]"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* List Sort Toggle — only in list view */}
          {viewMode === "list" && (
            <button
              onClick={() => setListSortNewest((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all text-[#9B98A0] hover:text-[#E5E5E7] glass-chip active:scale-95"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{listSortNewest ? "Newest first" : "Oldest first"}</span>
            </button>
          )}

          {/* Stepper Controls */}
          <div className="flex items-center gap-1 rounded-full p-1 glass-cell">
            <button
              onClick={handlePrev}
              aria-label="Previous Period"
              className="p-1 rounded-full text-[#9B98A0] hover:text-[#E5E5E7] hover:bg-[#241416] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono font-bold px-2.5 text-[#E5E5E7] whitespace-nowrap min-w-[125px] text-center">
              {activeTitle}
            </span>
            <button
              onClick={handleToday}
              className="px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-full text-[#E0A3AA] hover:bg-[#241416] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              aria-label="Next Period"
              className="p-1 rounded-full text-[#9B98A0] hover:text-[#E5E5E7] hover:bg-[#241416] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Viewport — Cylindrical Coverflow Arc for period paging; the month ⇄
          week mode switch is animated by the row/card motions inside
          renderCalendarContent ("deck of cards / horizontal blinds" unfold).
          - Side arrow buttons on desktop (>= xl) when ample space is available
          - Swiping left/right on all devices navigates periods */}
      <div className="relative w-full">
        {/* Desktop Floating Side Navigation Arrows — visible only when gutters have >= 52px space */}
        {hasSideSpace && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous Period"
              className="cal-nav-arrow flex absolute -left-12 top-48 -translate-y-1/2 z-30 h-10 w-10 items-center justify-center rounded-full shadow-xl group cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Period"
              className="cal-nav-arrow flex absolute -right-12 top-48 -translate-y-1/2 z-30 h-10 w-10 items-center justify-center rounded-full shadow-xl group cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </>
        )}

        {/* Viewport with swipe, pan, and desktop wheel support */}
        <div
          ref={viewportRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full overflow-hidden select-none py-1 overscroll-contain"
        >
          <motion.div
            key={viewMode}
            onPanEnd={handlePanEnd}
            initial={
              modeTransition === "month"
                // Month expand: rows slide down from collapsed height — scaleY grows from 0
                ? { scaleY: 0.6, opacity: 0, transformOrigin: "top center" }
                : modeTransition === "week"
                ? { scale: 0.93, opacity: 0.4 }
                : modeTransition === "list"
                ? { scale: 0.94, opacity: 0.4 }
                : { scale: 1, opacity: 1 }
            }
            animate={
              modeTransition === "month"
                ? {
                    scaleY: 1,
                    opacity: 1,
                    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                  }
                : modeTransition === "week"
                ? {
                    scale: 1,
                    opacity: 1,
                    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                  }
                : modeTransition === "week-fold" || modeTransition === "week-shrink"
                ? {
                    scale: 0.9,
                    opacity: 0.25,
                    transition: { duration: 0.22, ease: [0.7, 0, 0.85, 0.36] },
                  }
                : modeTransition === "list"
                ? {
                    scale: 1,
                    opacity: 1,
                    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                  }
                : { scale: 1, opacity: 1 }
            }
            style={{ willChange: "transform, opacity" }}
            className="w-full"
          >
              <div className="relative w-full">
                {/* Invisible flow placeholder: guarantees exact, natural height across devices */}
                <div
                  className="invisible pointer-events-none select-none w-full"
                  aria-hidden="true"
                >
                  {renderCalendarContent(activeIndex, false)}
                </div>

                {/* Cylindrical Coverflow Arc Carousel Ring Slides — list view shows only the center slide */}
                {(viewMode === "list" ? [0] : [-2, -1, 0, 1, 2]).map((offset) => {
                  const itemIndex = activeIndex + offset;
                  const transform = getCoverflowArcTransform(offset, isTransitioning);
                  const isCenter = offset === 0;

                  return (
                    <motion.div
                      key={itemIndex}
                      animate={transform}
                      transition={coverflowSpring}
                      style={{
                        transformStyle: "preserve-3d",
                        willChange: "transform, opacity",
                        backfaceVisibility: "hidden",
                      }}
                      className={`absolute inset-0 w-full rounded-2xl ${
                        isCenter ? "pointer-events-auto" : "pointer-events-none"
                      }`}
                    >
                      {/* Main-period veil: fades in while a month/week change is in
                          flight and back out the moment the arc settles, so the
                          centre slide reads as the solid "main page" instead of
                          one more sheet of glass while the neighbours arc past.
                          Only ~45% opaque, so the neighbouring slides stay
                          clearly visible — the 3D depth IS the animation. At
                          rest it is fully transparent and the original
                          translucent glass look is untouched.
                          Month/Week only — list view is a long scroll surface,
                          not the calendar itself. */}
                      {isCenter && viewMode !== "list" && (
                        <motion.div
                          aria-hidden="true"
                          className="cal-slide-veil absolute inset-0 rounded-2xl pointer-events-none"
                          initial={false}
                          animate={{ opacity: isTransitioning ? 1 : 0 }}
                          transition={{
                            duration: isTransitioning ? 0.15 : 0.3,
                            ease: "easeOut",
                          }}
                        />
                      )}
                      {/* `relative` (zero offsets, no layout change) makes the
                          calendar content a positioned sibling painted in tree
                          order after the veil, so it is guaranteed to sit above
                          it even inside the slide's preserve-3d context, where
                          z-sorting rules are subtler than in plain 2D. */}
                      <div className="relative w-full">
                        {renderCalendarContent(itemIndex, isCenter)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
          </motion.div>
        </div>
      </div>

      {/* Shared Layout Event Modal Overlay (Clean solid dark styling without liquid glass) */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl glass-panel p-5 sm:p-6 shadow-2xl relative overflow-hidden bg-black/50"
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedEvent(null)}
              aria-label="Close details"
              className="absolute top-4 right-4 p-1.5 rounded-full glass-chip text-[#9B98A0] hover:text-[#FFFFFF] transition-all shadow-md"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Content */}
            <div className="space-y-3.5">
              {/* Title */}
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#E5E5E7] leading-tight pr-8">
                {selectedEvent.title}
              </h3>

              {/* Date, Time, Location metadata */}
              <div className="flex flex-col gap-1.5 py-2.5 border-y border-[#242021] text-[#9B98A0] text-xs font-mono">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0" />
                  <span>{selectedEvent.date}</span>
                  <Clock className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0 ml-3" />
                  <span>{selectedEvent.time}</span>
                </div>
                <div className="flex items-center gap-2 font-sans text-xs">
                  <MapPin className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0" />
                  <span className="text-[#E5E5E7]">{selectedEvent.location}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-[10px] uppercase font-mono tracking-wider text-[#67646C] mb-1">
                  Event Details
                </h4>
                <p className="text-xs sm:text-sm text-[#E5E5E7] leading-relaxed">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1 gap-2 bg-[#241416] text-[#FFFFFF] border-[#5E2C32] hover:bg-[#3D1E22]"
                >
                  <a
                    href={generateGoogleCalendarUrl(selectedEvent)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Add to Google Calendar</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#E0A3AA]" />
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                  className="border border-[#242021]"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
