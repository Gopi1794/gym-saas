import {
  MonoRoundedKpiCard,
  type MonoKpiChart,
  type MonoKpiColor,
} from "@/components/mono-charts/MonoRoundedKpiCard"

interface ActivityCardProps {
  label: string
  value: number | string
  unit?: string
  chart: MonoKpiChart
  color?: MonoKpiColor
  data?: number[]
  progress?: number
}

export default function ActivityCard({ label, value, unit, chart, color = "violet", data, progress }: ActivityCardProps) {
  return <MonoRoundedKpiCard label={label} value={value} unit={unit} chart={chart} color={color} data={data} progress={progress} />
}
