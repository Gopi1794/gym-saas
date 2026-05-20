"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, isSameDay, isToday, getDate, getDaysInMonth, startOfMonth, isFuture } from "date-fns"
import { es } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  maxDate?: Date
}

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, maxDate, ...props }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(propSelectedDate ?? new Date())
    const [selected, setSelected] = React.useState(propSelectedDate ?? new Date())
    const [direction, setDirection] = React.useState(0)

    const monthDays = React.useMemo(() => {
      const start = startOfMonth(currentMonth)
      return Array.from({ length: getDaysInMonth(currentMonth) }, (_, i) => {
        const date = new Date(start.getFullYear(), start.getMonth(), i + 1)
        return {
          date,
          isToday: isToday(date),
          isSelected: isSameDay(date, selected),
          isDisabled: maxDate ? isFuture(date) && !isSameDay(date, maxDate) : false,
        }
      })
    }, [currentMonth, selected, maxDate])

    function handleDateClick(date: Date) {
      setSelected(date)
      onDateSelect?.(date)
    }

    function handlePrev() {
      setDirection(-1)
      setCurrentMonth(subMonths(currentMonth, 1))
    }

    function handleNext() {
      setDirection(1)
      const next = addMonths(currentMonth, 1)
      if (maxDate && isFuture(next)) return
      setCurrentMonth(next)
    }

    const isNextDisabled = maxDate
      ? format(addMonths(currentMonth, 1), "yyyy-MM") > format(maxDate, "yyyy-MM")
      : false

    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-2xl overflow-hidden",
          "bg-zinc-900/80 backdrop-blur-xl border border-white/10",
          "shadow-xl shadow-black/40",
          className
        )}
        {...props}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={format(currentMonth, "yyyy-MM")}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.2 }}
              className="text-base font-semibold text-zinc-100 capitalize"
            >
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </motion.p>
          </AnimatePresence>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              aria-label="Mes anterior"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              aria-label="Mes siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-1">
          {["D", "L", "M", "X", "J", "V", "S"].map((d) => (
            <div key={d} className="flex h-7 items-center justify-center text-xs font-semibold uppercase text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="px-4 pb-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={format(currentMonth, "yyyy-MM")}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 30 }}
              transition={{ duration: 0.2 }}
            >
              {/* Offset first day */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {monthDays.map((day) => (
                  <button
                    key={format(day.date, "yyyy-MM-dd")}
                    onClick={() => !day.isDisabled && handleDateClick(day.date)}
                    disabled={day.isDisabled}
                    aria-label={format(day.date, "d 'de' MMMM")}
                    aria-pressed={day.isSelected}
                    className={cn(
                      "relative flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-all duration-150",
                      day.isSelected
                        ? "bg-brand-600 text-white shadow-md shadow-brand-900/40"
                        : day.isToday
                          ? "bg-zinc-800 text-brand-400 ring-1 ring-brand-700/50"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
                      day.isDisabled && "cursor-not-allowed opacity-25",
                    )}
                  >
                    {getDate(day.date)}
                    {day.isToday && !day.isSelected && (
                      <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    )
  }
)

GlassCalendar.displayName = "GlassCalendar"
