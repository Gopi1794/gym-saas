"use client";

import { motion } from "framer-motion";

export function PulsatingDots() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex space-x-2">
        {[0, 0.3, 0.6].map((delay, i) => (
          <motion.div
            key={i}
            className="h-3 w-3 rounded-full bg-brand-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, ease: "easeInOut", repeat: Infinity, delay }}
          />
        ))}
      </div>
    </div>
  );
}

export function RippleWaveLoader() {
  return (
    <div className="flex items-center justify-center space-x-1">
      {[...Array(7)].map((_, i) => (
        <motion.div
          key={i}
          className="h-8 w-2 rounded-full bg-brand-500"
          animate={{
            scaleY: [0.5, 1.5, 0.5],
            scaleX: [1, 0.8, 1],
            translateY: ["0%", "-15%", "0%"],
          }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}

export default function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <RippleWaveLoader />
      <p className="font-heading text-xs tracking-widest text-zinc-500">CARGANDO</p>
    </div>
  );
}
