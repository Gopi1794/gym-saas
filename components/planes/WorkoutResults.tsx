"use client"

import { motion } from "framer-motion"
import AchievementBadge from "@/components/achievements/AchievementBadge"
import LottiePlayer from "@/components/ui/lottie-player"
import type { EarnedAchievement } from "@/lib/achievements/types"

type Props = {
  result: {
    ok: true
    xp_earned: number
    new_total_xp: number
    earned_achievements: EarnedAchievement[]
  }
  totalCalories?: number
  onClose: () => void
}

const containerVariants = {
  container: {
    transition: { staggerChildren: 0.15 },
  },
}

const badgeVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
}

export default function WorkoutResults({ result, totalCalories, onClose }: Props) {
  const hasAchievements = result.earned_achievements.length > 0

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-6 text-center">
      {/* Confetti animation */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <LottiePlayer
          src="/animations/Confetti.lottie"
          autoplay
          loop={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-brand-700/20 blur-[100px]" />

      {/* XP earned — prominent */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-1"
      >
        <span className="text-8xl font-black leading-none text-brand-500">
          +{result.xp_earned}
        </span>
        <span className="text-3xl font-bold text-brand-400">XP</span>
        <p className="mt-2 text-sm text-zinc-400">
          Total acumulado:{" "}
          <span className="font-semibold text-zinc-200">{result.new_total_xp} XP</span>
        </p>
        {totalCalories != null && totalCalories > 0 && (
          <p className="mt-1 text-sm text-zinc-500">
            ~<span className="font-semibold text-zinc-300">{totalCalories} kcal</span> quemadas
          </p>
        )}
      </motion.div>

      {/* Achievements section */}
      {hasAchievements ? (
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-bold text-zinc-100">¡Logros desbloqueados!</h2>

          <motion.div
            className="flex flex-wrap justify-center gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="container"
          >
            {result.earned_achievements.map((a) => (
              <motion.div key={a.id} variants={badgeVariants} initial="hidden" animate="visible">
                <AchievementBadge
                  achievement={a}
                  variant="just-earned"
                  earned_at={a.earned_at}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-base text-zinc-400"
        >
          ¡Buen entrenamiento! Seguí así 💪
        </motion.p>
      )}

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
        onClick={onClose}
        className="w-full max-w-xs rounded-full bg-brand-700 py-4 text-sm font-bold text-white shadow-lg shadow-brand-700/40 transition-all hover:bg-brand-600 active:scale-[0.97]"
        style={{ transition: "transform 150ms cubic-bezier(0.16,1,0.3,1), background 200ms ease" }}
      >
        Volver a mi rutina
      </motion.button>
    </div>
  )
}
