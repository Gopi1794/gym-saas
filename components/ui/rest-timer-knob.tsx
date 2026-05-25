"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const MIN_DEG = -135;
const MAX_DEG = 135;
const TOTAL_TICKS = 40;

interface Props {
  total: number;
  left: number;
}

function TickMark({
  currentRotation,
  angle,
}: {
  currentRotation: ReturnType<typeof useSpring>;
  angle: number;
}) {
  const color = useTransform(currentRotation, (r: number) =>
    r >= angle ? "#d50000" : "#404040",
  );
  const shadow = useTransform(currentRotation, (r: number) =>
    r >= angle ? "0 0 8px #500000" : "none",
  );
  const opacity = useTransform(currentRotation, (r: number) =>
    r >= angle ? 1 : 0.2,
  );

  return (
    <motion.div
      style={{ backgroundColor: color, opacity, boxShadow: shadow }}
      className="w-1 h-2.5 rounded-full"
    />
  );
}

export default function RestTimerKnob({ total, left }: Props) {
  const initialDeg =
    total > 0 ? MIN_DEG + (left / total) * (MAX_DEG - MIN_DEG) : MAX_DEG;
  const rawRotation = useMotionValue(initialDeg);
  const smoothRotation = useSpring(rawRotation, {
    stiffness: 120,
    damping: 20,
    mass: 0.6,
  });

  useEffect(() => {
    rawRotation.set(MIN_DEG + (left / (total || 1)) * (MAX_DEG - MIN_DEG));
  }, [left, total, rawRotation]);

  const glowOpacity = useTransform(
    smoothRotation,
    [MIN_DEG, MAX_DEG],
    [0.02, 0.25],
  );
  const indicatorGlow = useTransform(
    smoothRotation,
    (r: number) => `0 0 ${Math.max(4, (r + 135) / 9)}px rgba(213,0,0,0.9)`,
  );

  const ticks = Array.from({ length: TOTAL_TICKS + 1 });

  return (
    <div className="relative w-52 h-52 select-none">
      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl bg-brand-700"
        style={{ opacity: glowOpacity }}
      />

      {/* Tick ring */}
      <div className="absolute inset-0 pointer-events-none">
        {ticks.map((_, i) => {
          const angle = (i / TOTAL_TICKS) * (MAX_DEG - MIN_DEG) + MIN_DEG;
          return (
            <div
              key={i}
              className="absolute top-0 left-1/2 w-1 h-full"
              style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
            >
              <TickMark currentRotation={smoothRotation} angle={angle} />
            </div>
          );
        })}
      </div>

      {/* Rotating knob body */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36">
        <motion.div
          className="relative w-full h-full rounded-full"
          style={{ rotate: smoothRotation }}
        >
          <div className="w-full h-full rounded-full bg-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-neutral-800 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent_50%)]" />
            <div className="relative w-24 h-24 rounded-full bg-neutral-950 shadow-[inset_0_2px_5px_rgba(0,0,0,1)] border border-neutral-800/50 flex items-center justify-center">
              <motion.div
                className="absolute top-3 w-1.5 h-4 bg-brand-700 rounded-full"
                style={{ boxShadow: indicatorGlow }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Seconds — centered overlay, does NOT rotate */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <span
          className="font-display text-5xl tabular-nums"
          style={{ color: "#ffffff", textShadow: "0 0 30px rgba(213,0,0,0.5)" }}
        >
          {left}
        </span>
      </div>
    </div>
  );
}
