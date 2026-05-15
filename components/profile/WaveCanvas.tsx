"use client"

import { useEffect, useRef } from "react"

export default function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    let time = 0

    const waveData = Array.from({ length: 8 }).map(() => ({
      value: Math.random() * 0.5 + 0.1,
      targetValue: Math.random() * 0.5 + 0.1,
      speed: Math.random() * 0.02 + 0.01,
    }))

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      waveData.forEach((data, i) => {
        if (Math.random() < 0.01) data.targetValue = Math.random() * 0.7 + 0.1
        data.value += (data.targetValue - data.value) * data.speed

        const freq = data.value * 7
        ctx.beginPath()
        for (let x = 0; x < canvas.width; x++) {
          const nx = (x / canvas.width) * 2 - 1
          const px = nx + i * 0.04 + freq * 0.03
          const py =
            Math.sin(px * 10 + time) *
            Math.cos(px * 2) *
            freq *
            0.1 *
            ((i + 1) / 8)
          const y = (py + 1) * (canvas.height / 2)
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }

        const intensity = Math.min(1, freq * 0.3)
        const r = Math.round(79 + intensity * 100)
        const g = Math.round(70 + intensity * 130)
        ctx.lineWidth = 0.8 + i * 0.25
        ctx.strokeStyle = `rgba(${r},${g},229,0.45)`
        ctx.shadowColor = `rgba(${r},${g},229,0.4)`
        ctx.shadowBlur = 6
        ctx.stroke()
        ctx.shadowBlur = 0
      })
    }

    function loop() {
      time += 0.018
      draw()
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
    />
  )
}
