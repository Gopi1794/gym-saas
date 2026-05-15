import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type WorkoutXExercise = {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
  gifUrl: string
  category: string
  difficulty: string
  description: string
}

type WorkoutXResponse = {
  total: number
  count: number
  data: WorkoutXExercise[]
}

const LIMIT = 100
const MAX_EXERCISES = 300

async function fetchAllExercises(): Promise<WorkoutXExercise[]> {
  const key = process.env.WORKOUTX_API_KEY
  if (!key) throw new Error("WORKOUTX_API_KEY not set")

  const all: WorkoutXExercise[] = []
  let offset = 0

  while (all.length < MAX_EXERCISES) {
    const res = await fetch(
      `https://api.workoutxapp.com/v1/exercises?limit=${LIMIT}&offset=${offset}`,
      {
        headers: { "X-WorkoutX-Key": key },
        cache: "no-store",
      }
    )
    if (!res.ok) throw new Error(`WorkoutX fetch failed: ${res.status}`)
    const data: WorkoutXResponse = await res.json()
    all.push(...data.data)
    offset += LIMIT
    if (data.count === 0 || data.data.length < LIMIT) break
  }

  return all.slice(0, MAX_EXERCISES)
}

const VALID_CATEGORIES = new Set(["strength", "cardio", "flexibility", "balance", "hiit"])
const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"])

export async function POST() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  let exercises: WorkoutXExercise[]
  try {
    exercises = await fetchAllExercises()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Remove old wger exercises before inserting WorkoutX ones
  await supabase.from("exercises").delete().like("external_id", "wger-%")

  const mapped = exercises.map((ex) => ({
    external_id: `workoutx-${ex.id}`,
    name: ex.name.toLowerCase(),
    description: ex.instructions.join(" "),
    category: VALID_CATEGORIES.has(ex.category) ? ex.category : "strength",
    muscle_groups: [ex.target, ...ex.secondaryMuscles].slice(0, 6),
    difficulty: VALID_DIFFICULTIES.has(ex.difficulty) ? ex.difficulty : "beginner",
    image_url: null,
  }))

  const BATCH = 100
  let inserted = 0

  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("exercises")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any[], { onConflict: "external_id", ignoreDuplicates: false })

    if (error) {
      console.error("Upsert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted += batch.length
  }

  return NextResponse.json({ ok: true, synced: inserted })
}
