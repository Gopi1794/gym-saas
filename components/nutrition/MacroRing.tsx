const MACRO_ICONS = {
  flame:   "M12,2 C10,7 8,10 8,14 C8,17.3 9.7,19.9 12,21 C14.3,19.9 16,17.3 16,14 C16,10 14,7 12,2 Z",
  protein: "M3,7 L7,7 L7,17 L3,17 Z M7,11 L17,11 L17,13 L7,13 Z M17,7 L21,7 L21,17 L17,17 Z",
  carbs:   "M12,3 L20.5,8 L20.5,16 L12,21 L3.5,16 L3.5,8 Z",
  fat:     "M12,3 C8,7 4,12 4,16 C4,20 7.6,22 12,22 C16.4,22 20,20 20,16 C20,12 16,7 12,3 Z",
}

interface MacroRingProps {
  label: string
  value: number
  target: number | null
  unit: string
  color: string
  icon: keyof typeof MACRO_ICONS
  uid: string
  /** 88 = full size (nutrition page), 72 = dashboard compact */
  dim?: number
  /** false = ring + side text (nutrition page), true = ring + label below (dashboard) */
  compact?: boolean
}

export function MacroRing({ label, value, target, unit, color, icon, uid, dim = 88, compact = false }: MacroRingProps) {
  const ringR = Math.round(dim * 0.386)
  const cx = dim / 2, cy = dim / 2
  const sw = Math.max(5, Math.round(dim * 0.08))
  const circ = 2 * Math.PI * ringR
  const pct = target ? Math.min(value / target, 1) : 0
  const dash = circ * Math.max(0.02, pct)
  const liq = ringR - sw / 2 - 1
  const fy = cy + liq - Math.max(0.04, pct) * 2 * liq
  const amp = liq * 0.12
  const W = liq * 2 * 3

  let wp = `M${cx - liq},${fy}`
  for (let i = 0; i < 6; i++) {
    const segW = W / 6
    const qx = (cx - liq) + i * segW + segW / 2
    const qy = fy + (i % 2 === 0 ? -amp : amp)
    const ex = (cx - liq) + (i + 1) * segW
    wp += ` Q${qx},${qy} ${ex},${fy}`
  }
  wp += ` L${cx - liq + W},${cy + liq} L${cx - liq},${cy + liq} Z`

  const particles = [
    { px: cx - liq * 0.3, sy: cy + liq * 0.5,  ey: cy - liq * 0.3, pr: 1.2, dur: "2.6s", begin: "0s"   },
    { px: cx + liq * 0.3, sy: cy + liq * 0.65, ey: cy - liq * 0.4, pr: 0.9, dur: "3.2s", begin: "0.9s" },
    { px: cx - liq * 0.1, sy: cy + liq * 0.75, ey: cy - liq * 0.2, pr: 0.7, dur: "2.4s", begin: "1.5s" },
  ]

  const iconScale = (liq * 0.62) / 12
  const it = cx - 12 * iconScale

  const ring = (
    <div style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <defs>
          <clipPath id={`${uid}cl`}><circle cx={cx} cy={cy} r={liq} /></clipPath>
          <filter id={`${uid}gl`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${uid}ha`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={liq} fill={`${color}12`} />

        <g clipPath={`url(#${uid}cl)`}>
          <g>
            <animateTransform attributeName="transform" type="translate"
              from="0,0" to={`${-(liq * 2)},0`} dur="3s" repeatCount="indefinite" />
            <path d={wp} fill={`${color}55`} />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate"
              from={`${-liq},0`} to={`${-(liq * 3)},0`} dur="4.2s" repeatCount="indefinite" />
            <path d={wp} fill={`${color}28`} />
          </g>
          {particles.map((p, i) => (
            <circle key={i} cx={p.px} cy={p.sy} r={p.pr} fill={color} opacity="0">
              <animate attributeName="cy" from={`${p.sy}`} to={`${p.ey}`} dur={p.dur} begin={p.begin} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0.6;0" keyTimes="0;0.1;0.75;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
              <animate attributeName="r" values={`${p.pr};${p.pr * 0.5};0`} keyTimes="0;0.7;1" dur={p.dur} begin={p.begin} repeatCount="indefinite" />
            </circle>
          ))}
        </g>

        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#27272a" strokeWidth={sw} className="stroke-zinc-200 dark:stroke-zinc-800" />
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
          strokeWidth={sw + 2} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}ha)`} opacity="0.4" />
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color}
          strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${uid}gl)`} />

        <g transform={`translate(${it},${it}) scale(${iconScale})`} opacity="0.8">
          <path d={MACRO_ICONS[icon]} fill={color} />
        </g>
      </svg>
    </div>
  )

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        {ring}
        <p className="text-xs font-black leading-none" style={{ color }}>{Math.round(value)}</p>
        <p className="text-[10px] text-zinc-500">{label}</p>
        {target && (
          <p className="text-[9px] text-zinc-600">/{target}{unit}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {ring}
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-xl font-black leading-none" style={{ color }}>{Math.round(value)}</p>
        {target
          ? <p className="mt-0.5 text-xs text-zinc-500">/ {target} {unit}</p>
          : <p className="mt-0.5 text-xs text-zinc-500">{unit}</p>}
      </div>
    </div>
  )
}
