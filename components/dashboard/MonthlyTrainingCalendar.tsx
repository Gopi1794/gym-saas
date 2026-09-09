import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const DOW = ["L", "M", "M", "J", "V", "S", "D"]
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export default function MonthlyTrainingCalendar({
  sessionDates,
  year,
  month,
}: {
  sessionDates: string[]
  year: number
  month: number
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7

  const trainedDays = new Set(
    sessionDates.map(d => d.split("T")[0])
  )

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = new Date()
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : -1

  return (
    <div className="max-w-none rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/[6%] dark:bg-zinc-900/50">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-brand-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {MONTHS[month]}
          </p>
          <p className="text-[11px] text-zinc-500">Calendario de entrenamientos</p>
        </div>
        <span className="ml-auto rounded-full bg-black/15 px-2 py-1 text-xs text-zinc-500">
          {trainedDays.size} entrenamientos
        </span>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DOW.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-semibold uppercase text-zinc-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const trained = trainedDays.has(dateStr)
          const isToday = day === todayDay
          return (
            <div
              key={day}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold",
                trained && "bg-brand-700 text-white shadow-[0_0_14px_rgba(213,0,0,0.28)]",
                !trained && isToday && "ring-1 ring-brand-500 text-brand-500 dark:text-brand-400",
                !trained && !isToday && "text-zinc-400 dark:text-zinc-600",
              )}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
