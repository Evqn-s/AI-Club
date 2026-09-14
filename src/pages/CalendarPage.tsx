import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { supabase, isSupabaseConfigured, type CalendarEvent } from "@/lib/supabase";
import {
  prefetchCalendar,
  getCachedCalendar,
  fallbackEvents,
} from "@/lib/cache";
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
} from "lucide-react";

// Date math helper functions anchored to noon (12:00) to prevent DST day rollover
function getDateForMonth(monthOffset: number): Date {
  return new Date(2026, 8 + monthOffset, 1, 12, 0, 0);
}

function getDateForWeek(weekOffset: number): Date {
  return new Date(2026, 8, 13 + weekOffset * 7, 12, 0, 0);
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
      return new Date(2026, m - 1, d, 12, 0, 0);
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
        const year = match[2] ? parseInt(match[2], 10) : 2026;
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
      return new Date(2026, 8, day, 12, 0, 0);
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
      isToday: dateString === "2026-09-13",
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
      isToday: dateString === "2026-09-13",
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
      isToday: dateString === "2026-09-13",
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
      isToday: dateString === "2026-09-13",
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

  const opacity = isTransitioning ? (Math.abs(offset) === 1 ? 0.75 : 0.35) : 0;

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

// Pure GPU accelerated Depth Zoom / Parallax Dive Variants (Month ↔ Week view toggling)
const diveVariants: Variants = {
  enter: (viewMode: "month" | "week") => ({
    scale: viewMode === "week" ? 0.88 : 1.12,
    y: viewMode === "week" ? 18 : -18,
    opacity: 0,
  }),
  center: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: (viewMode: "month" | "week") => ({
    scale: viewMode === "week" ? 1.12 : 0.88,
    y: viewMode === "week" ? -18 : 18,
    opacity: 0,
    transition: {
      duration: 0.26,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

// ==========================================
// MEMOIZED CALENDAR SUBCOMPONENTS
// ==========================================

// Month Event Button: Compact on desktop, hidden on mobile
const MonthEventCard = memo(function MonthEventCard({
  evt,
  isHighlighted,
  isInteractive,
  onSelect,
}: {
  evt: CalendarEvent;
  isHighlighted: boolean;
  isInteractive: boolean;
  onSelect: (evt: CalendarEvent) => void;
}) {
  return (
    <button
      onClick={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        onSelect(evt);
      }}
      className={`w-full text-left p-1 md:p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
        isHighlighted
          ? "bg-[#241416] border-[#E0A3AA] ring-2 ring-[#E0A3AA] shadow-[0_0_16px_rgba(224,163,170,0.5)]"
          : "bg-[#1E1A1B] border-[#242021] hover:border-[#5E2C32]/80"
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
      className={`min-h-[46px] sm:min-h-[54px] md:min-h-[85px] lg:min-h-[96px] xl:min-h-[105px] rounded-lg md:rounded-xl border p-1 md:p-1.5 flex flex-col justify-between transition-colors ${
        hasEvents ? "cursor-pointer md:cursor-default" : ""
      } ${
        dayObj.isCurrentMonth
          ? "bg-[#141213] border-[#242021]"
          : "bg-[#141213]/40 border-[#242021]/30 opacity-40"
      } ${
        isDateSearched
          ? "ring-2 ring-[#E0A3AA] border-[#E0A3AA] shadow-[0_0_18px_rgba(224,163,170,0.4)]"
          : dayObj.isToday
          ? "ring-1 ring-[#E0A3AA] border-[#5E2C32] shadow-[0_0_10px_rgba(224,163,170,0.15)]"
          : ""
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
            className={`h-1.5 w-1.5 rounded-full transition-all ${
              evt.id === highlightedEventId || isAnyHighlighted || isDateSearched
                ? "bg-[#E0A3AA] ring-2 ring-[#E0A3AA] scale-125 shadow-[0_0_6px_#E0A3AA]"
                : "bg-[#E0A3AA] shadow-[0_0_4px_rgba(224,163,170,0.4)]"
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
}) {
  const [selectedDayString, setSelectedDayString] = useState<string>(() => {
    if (highlightedDateString && weekDays.some((d) => d.dateString === highlightedDateString)) {
      return highlightedDateString;
    }
    const todayMatch = weekDays.find((d) => d.isToday);
    return todayMatch ? todayMatch.dateString : weekDays[0]?.dateString || "";
  });

  useEffect(() => {
    if (highlightedDateString && weekDays.some((d) => d.dateString === highlightedDateString)) {
      setSelectedDayString(highlightedDateString);
      return;
    }
    const exists = weekDays.some((d) => d.dateString === selectedDayString);
    if (!exists) {
      const todayMatch = weekDays.find((d) => d.isToday);
      setSelectedDayString(todayMatch ? todayMatch.dateString : weekDays[0]?.dateString || "");
    }
  }, [weekDays, selectedDayString, highlightedDateString]);

  const activeDayObj = weekDays.find((d) => d.dateString === selectedDayString) || weekDays[0];
  const dayEvents = events.filter((e) => e.date === selectedDayString);

  return (
    <div className="flex flex-col gap-3 w-full md:hidden select-text">
      {/* Horizontal Day Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none w-full">
        {weekDays.map((d) => {
          const isSelected = d.dateString === selectedDayString;
          const hasEvents = events.some((e) => e.date === d.dateString);
          return (
            <button
              key={d.dateString}
              onClick={() => setSelectedDayString(d.dateString)}
              className={`flex-1 min-w-[44px] py-1.5 px-1 rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                isSelected
                  ? "bg-[#241416] border-[#E0A3AA] text-[#E0A3AA] shadow-sm"
                  : "bg-[#141213] border-[#242021] text-[#9B98A0] hover:border-[#382D30]"
              }`}
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
                className={`h-1 w-1 rounded-full ${
                  hasEvents
                    ? isSelected
                      ? "bg-[#E0A3AA]"
                      : "bg-[#E0A3AA]/60"
                    : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Day Activities or Blank Space */}
      <div className="p-4 rounded-2xl border border-[#242021] bg-[#141213] min-h-[220px] flex flex-col justify-center">
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
            {dayEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={(e) => {
                  if (!isInteractive) return;
                  e.stopPropagation();
                  onSelectEvent(evt);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                  evt.id === highlightedEventId
                    ? "bg-[#241416] border-[#E0A3AA] ring-2 ring-[#E0A3AA]"
                    : "bg-[#1E1A1B] border-[#242021]"
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

                <div className="pt-2">
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
              </div>
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
            className={`rounded-2xl border p-2.5 flex flex-col gap-2.5 min-h-[350px] lg:min-h-[380px] transition-colors ${
              isDateSearched
                ? "bg-[#241416]/70 border-[#E0A3AA] ring-2 ring-[#E0A3AA] shadow-[0_0_18px_rgba(224,163,170,0.35)]"
                : dayObj.isToday
                ? "bg-[#241416]/50 border-[#5E2C32] ring-1 ring-[#E0A3AA]/60 shadow-[0_0_14px_rgba(224,163,170,0.15)]"
                : "bg-[#141213] border-[#242021]"
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
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        if (!isInteractive) return;
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all min-h-[75%] ${
                        isHighlighted
                          ? "bg-[#241416] border-[#E0A3AA] ring-2 ring-[#E0A3AA] shadow-[0_0_20px_rgba(224,163,170,0.5)]"
                          : "bg-[#1E1A1B] border-[#242021] hover:border-[#382D30]"
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
                    </div>
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
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Transition state: activates the cylindrical ring display during arrow navigation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      notifyAnimationComplete();
    };
  }, [notifyAnimationComplete]);

  // Search & Database lookup state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [highlightedDateString, setHighlightedDateString] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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
  useEffect(() => {
    let isMounted = true;
    fetchEvents();

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
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
    }

    return () => {
      isMounted = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
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

  // Live Database Search: prioritizes title over description, and supports searching specific dates
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
          const diffTime = parsedDate.getTime() - new Date(2026, 8, 13, 12, 0, 0).getTime();
          const targetWeekIndex = Math.round(diffTime / (7 * 86400000));
          const targetMonthIndex =
            (parsedDate.getFullYear() - 2026) * 12 + (parsedDate.getMonth() - 8);

          const y = parsedDate.getFullYear();
          const m = String(parsedDate.getMonth() + 1).padStart(2, "0");
          const d = String(parsedDate.getDate()).padStart(2, "0");
          const targetDateString = `${y}-${m}-${d}`;

          triggerTransition();
          if (viewMode === "week") {
            setActiveIndex(targetWeekIndex);
          } else {
            setActiveIndex(targetMonthIndex);
          }

          setHighlightedDateString(targetDateString);

          // If an event exists on that day, also highlight the event card
          const eventOnDay = events.find((e) => e.date === targetDateString);
          setHighlightedEventId(eventOnDay ? eventOnDay.id : null);
          return;
        }

        // 2. Keyword Search prioritizing TITLE over description/location
        let matched: CalendarEvent | null = null;

        // Query Supabase: first strictly check title
        if (isSupabaseConfigured && supabase) {
          const { data: titleData, error: titleError } = await supabase
            .from("events")
            .select("*")
            .ilike("title", `%${q}%`)
            .order("date", { ascending: true })
            .limit(1);

          if (!titleError && titleData && titleData.length > 0) {
            matched = titleData[0];
          } else {
            // Only if NO title match exists, search description and location
            const { data: descData } = await supabase
              .from("events")
              .select("*")
              .or(`description.ilike.%${q}%,location.ilike.%${q}%`)
              .order("date", { ascending: true })
              .limit(1);

            if (descData && descData.length > 0) {
              matched = descData[0];
            }
          }
        }

        // Local array fallback: check title first
        if (!matched) {
          const lowerQ = q.toLowerCase();
          matched = events.find((evt) => evt.title.toLowerCase().includes(lowerQ)) || null;

          if (!matched) {
            matched =
              events.find(
                (evt) =>
                  evt.description.toLowerCase().includes(lowerQ) ||
                  evt.location.toLowerCase().includes(lowerQ)
              ) || null;
          }
        }

        // 3. If a match is found: navigate to its date and highlight it
        if (matched) {
          const [y, m, d] = matched.date.split("-").map(Number);
          const targetDate = new Date(y, m - 1, d, 12, 0, 0);
          const diffTime = targetDate.getTime() - new Date(2026, 8, 13, 12, 0, 0).getTime();
          const targetWeekIndex = Math.round(diffTime / (7 * 86400000));
          const targetMonthIndex = (y - 2026) * 12 + (m - 1 - 8);

          triggerTransition();
          if (viewMode === "week") {
            setActiveIndex(targetWeekIndex);
          } else {
            setActiveIndex(targetMonthIndex);
          }

          setHighlightedEventId(matched.id);
          setHighlightedDateString(matched.date);
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
    [events, viewMode, triggerTransition]
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
    triggerTransition();
    setActiveIndex((prev) => prev - 1);
  }, [triggerTransition]);

  const handleNext = useCallback(() => {
    triggerTransition();
    setActiveIndex((prev) => prev + 1);
  }, [triggerTransition]);

  const handleToday = useCallback(() => {
    if (activeIndex === 0) return;
    triggerTransition();
    setActiveIndex(0);
  }, [activeIndex, triggerTransition]);

  // Swipe gestures for all devices (touch, mouse drag, trackpad)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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
    [handleNext, handlePrev]
  );

  const handlePanEnd = useCallback(
    (_e: any, info: { offset: { x: number; y: number } }) => {
      if (Math.abs(info.offset.x) > 45 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.3) {
        if (info.offset.x < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    },
    [handleNext, handlePrev]
  );

  // Desktop Mouse Wheel navigation: scrolling changes week/month
  const lastWheelTime = useRef<number>(0);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Only active on desktop screens (>= 1024px)
      if (typeof window !== "undefined" && window.innerWidth < 1024) return;

      const now = Date.now();
      if (now - lastWheelTime.current < 380) return;

      if (Math.abs(e.deltaY) > 25 || Math.abs(e.deltaX) > 25) {
        lastWheelTime.current = now;
        if (e.deltaY > 25 || e.deltaX > 25) {
          handleNext();
        } else if (e.deltaY < -25 || e.deltaX < -25) {
          handlePrev();
        }
      }
    },
    [handleNext, handlePrev]
  );

  // View switch handler (seamless context preservation + Depth Zoom / Parallax Dive)
  const handleViewToggle = useCallback(
    (newMode: "month" | "week") => {
      if (newMode === viewMode) return;
      notifyAnimationStart();
      if (newMode === "week") {
        const monthDate = getDateForMonth(activeIndex);
        const targetDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 13, 12, 0, 0);
        const diffWeeks = Math.round(
          (targetDate.getTime() - new Date(2026, 8, 13, 12, 0, 0).getTime()) / (7 * 86400000)
        );
        setActiveIndex(diffWeeks);
      } else {
        const weekDate = getDateForWeek(activeIndex);
        const diffMonths = (weekDate.getFullYear() - 2026) * 12 + (weekDate.getMonth() - 8);
        setActiveIndex(diffMonths);
      }
      setViewMode(newMode);
    },
    [viewMode, activeIndex, notifyAnimationStart]
  );

  // Active period title
  const activeTitle = useMemo(() => {
    if (viewMode === "month") {
      return getMonthData(getDateForMonth(activeIndex)).monthTitle;
    } else {
      return getWeekData(getDateForWeek(activeIndex)).weekTitle;
    }
  }, [viewMode, activeIndex]);

  // Render content helper for Month or Week view for any period index
  const renderCalendarContent = useCallback(
    (itemIndex: number, isInteractive: boolean) => {
      if (viewMode === "month") {
        const monthDate = getDateForMonth(itemIndex);
        const { monthDays } = getMonthData(monthDate);

        return (
          <div className="space-y-1.5 select-text">
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

            {/* 7-Column Days Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
              {monthDays.map((dayObj, idx) => {
                const dayEvents = events.filter((e) => e.date === dayObj.dateString);
                return (
                  <MonthDayCell
                    key={`${dayObj.dateString}-${idx}`}
                    dayObj={dayObj}
                    dayEvents={dayEvents}
                    highlightedEventId={highlightedEventId}
                    highlightedDateString={highlightedDateString}
                    isInteractive={isInteractive}
                    onSelectEvent={setSelectedEvent}
                  />
                );
              })}
            </div>
          </div>
        );
      } else {
        const weekDate = getDateForWeek(itemIndex);
        const { weekDays } = getWeekData(weekDate);

        return (
          <>
            {/* Mobile View: Horizontal day strip + Full view activity */}
            <MobileWeekView
              weekDays={weekDays}
              events={events}
              highlightedEventId={highlightedEventId}
              highlightedDateString={highlightedDateString}
              isInteractive={isInteractive}
              onSelectEvent={setSelectedEvent}
              generateGoogleCalendarUrl={generateGoogleCalendarUrl}
            />

            {/* Desktop View: Compact 7-column grid */}
            <DesktopWeekView
              weekDays={weekDays}
              events={events}
              highlightedEventId={highlightedEventId}
              highlightedDateString={highlightedDateString}
              isInteractive={isInteractive}
              onSelectEvent={setSelectedEvent}
            />
          </>
        );
      }
    },
    [viewMode, events, highlightedEventId, highlightedDateString, generateGoogleCalendarUrl]
  );

  // Only display Skeleton if cached data is null/empty and network is actively loading
  if (loading && events.length === 0) {
    return <CalendarSkeleton />;
  }

  return (
    <div
      data-page="calendar"
      className={`space-y-4 py-4 mx-auto w-full ${
        viewMode === "month" ? "max-w-3xl lg:max-w-4xl" : "max-w-5xl lg:max-w-6xl"
      }`}
    >
      {/* Page Header — Clean without sync button */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#241416] border border-[#5E2C32] text-[10px] font-mono font-bold text-[#E0A3AA]">
            03
          </span>
          <span className="text-[11px] uppercase tracking-widest text-[#E0A3AA] font-mono">
            Upcoming Schedule
          </span>
        </div>
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-2.5 rounded-2xl border border-[#242021] bg-[#141213]">
        {/* Live Database Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#67646C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search event title or day (e.g. 'Workshop', 'Sep 15', '22')..."
            className="w-full pl-9 pr-9 py-1.5 text-xs bg-[#1E1A1B] border border-[#242021] rounded-full text-[#E5E5E7] placeholder:text-[#67646C] focus:outline-none focus:border-[#E0A3AA] focus:ring-1 focus:ring-[#E0A3AA] transition-all"
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
          <div className="flex items-center p-1 rounded-full border border-[#242021] bg-[#1E1A1B]">
            <button
              onClick={() => handleViewToggle("month")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all ${
                viewMode === "month"
                  ? "bg-[#241416] text-[#E0A3AA] font-bold shadow-sm border border-[#5E2C32]"
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
                  ? "bg-[#241416] text-[#E0A3AA] font-bold shadow-sm border border-[#5E2C32]"
                  : "text-[#9B98A0] hover:text-[#E5E5E7]"
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Week</span>
            </button>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-1 border border-[#242021] rounded-full p-1 bg-[#1E1A1B]">
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

      {/* Main 3D Viewport with Depth Zoom / Parallax Dive + Cylindrical Coverflow Arc
          - Mode popLayout guarantees ZERO blank pauses when switching Month ↔ Week
          - Side arrow buttons on desktop (>= xl) when ample space is available
          - Swiping left/right on all devices navigates periods */}
      <div className="relative w-full">
        {/* Desktop Floating Side Navigation Arrows */}
        <button
          onClick={handlePrev}
          aria-label="Previous Period"
          className="cal-nav-arrow hidden xl:flex absolute -left-12 top-1/2 -translate-y-1/2 z-30 h-10 w-10 items-center justify-center rounded-full shadow-xl backdrop-blur-sm group cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </button>

        <button
          onClick={handleNext}
          aria-label="Next Period"
          className="cal-nav-arrow hidden xl:flex absolute -right-12 top-1/2 -translate-y-1/2 z-30 h-10 w-10 items-center justify-center rounded-full shadow-xl backdrop-blur-sm group cursor-pointer"
        >
          <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Viewport with swipe, pan, and desktop wheel support */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="relative w-full overflow-hidden select-none py-1"
        >
          <AnimatePresence mode="wait" custom={viewMode} initial={false}>
            <motion.div
              key={viewMode}
              custom={viewMode}
              variants={diveVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onPanEnd={handlePanEnd}
              onAnimationStart={notifyAnimationStart}
              onAnimationComplete={notifyAnimationComplete}
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

                {/* Cylindrical Coverflow Arc Carousel Ring Slides */}
                {[-2, -1, 0, 1, 2].map((offset) => {
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
                      {renderCalendarContent(itemIndex, isCenter)}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Shared Layout Event Modal Overlay (Light & Dark mode perfected) */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-[#382D30] bg-[#141213] p-5 shadow-2xl relative overflow-hidden"
            style={{ boxShadow: "0 0 35px rgba(224, 163, 170, 0.25)" }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedEvent(null)}
              aria-label="Close details"
              className="absolute top-4 right-4 p-1.5 rounded-full border border-[#242021] bg-[#1E1A1B] text-[#9B98A0] hover:text-[#E5E5E7] transition-colors"
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
