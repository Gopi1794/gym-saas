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
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[6%] bg-white dark:bg-zinc-900/50 p-4 max-w-sm">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-brand-500" />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {MONTHS[month]}
        </p>
        <span className="ml-auto text-xs text-zinc-500">
          {trainedDays.size} entrenamientos
        </span>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-semibold text-zinc-400 uppercase">
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
                "aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold",
                trained && "bg-brand-700 text-white",
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
