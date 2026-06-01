"use server"

import { createClient } from "@/lib/supabase/server"

const VALID_CATEGORIES = new Set(["strength", "cardio", "flexibility", "balance", "hiit"])
const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"])

export type ImportResult = {
  total: number
  upserted: number
  errors: { row: number; message: string }[]
}

type ParsedRow = {
  external_id: string
  name: string
  description: string
  category: string
  difficulty: string
  muscle_groups_raw: string
  rowNum: number
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export async function importExercisesFromCSV(csvContent: string): Promise<ImportResult> {
  const supabase = createClient()
  const lines = csvContent.trim().split("\n").filter(Boolean)
  const dataLines = lines.slice(1)
  const errors: ImportResult["errors"] = []

  const rows: ParsedRow[] = dataLines.map((line: string, idx: number) => {
    const cols = parseCSVLine(line)
    const [external_id = "", name = "", description = "", category = "", difficulty = "", muscle_groups_raw = ""] = cols
    return { external_id, name, description, category, difficulty, muscle_groups_raw, rowNum: idx + 2 }
  })

  const valid = rows.filter(({ external_id, name, rowNum }: ParsedRow) => {
    if (!external_id || !name) {
      errors.push({ row: rowNum, message: `Fila ${rowNum}: external_id o name vacío` })
      return false
    }
    return true
  })

  if (valid.length === 0) {
    return { total: dataLines.length, upserted: 0, errors }
  }

  const payload = valid.map(({ external_id, name, description, category, difficulty, muscle_groups_raw }: ParsedRow) => ({
    external_id,
    name: name.toLowerCase(),
    description: description || null,
    category: VALID_CATEGORIES.has(category) ? category : "strength",
    difficulty: VALID_DIFFICULTIES.has(difficulty) ? difficulty : "beginner",
    muscle_groups: muscle_groups_raw ? muscle_groups_raw.split("|").map((m: string) => m.trim()).filter(Boolean) : [],
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("exercises")
    .upsert(payload, { onConflict: "external_id", ignoreDuplicates: false })

  if (error) {
    errors.push({ row: 0, message: `Supabase error: ${error.message}` })
    return { total: dataLines.length, upserted: 0, errors }
  }

  return { total: dataLines.length, upserted: valid.length, errors }
}

export async function exportExercisesAsCSV(): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("exercises")
    .select("external_id, name, description, category, difficulty, muscle_groups")
    .order("name")

  if (error || !data) return ""

  const header = "external_id,name,description,category,difficulty,muscle_groups"
  const rowLines = data.map((ex) => {
    const extId = (ex as { external_id: string | null }).external_id ?? ""
    const muscles = ((ex as { muscle_groups: string[] }).muscle_groups ?? []).join("|")
    return [
      escapeCSVField(extId),
      escapeCSVField((ex as { name: string }).name),
      escapeCSVField((ex as { description: string | null }).description ?? ""),
      escapeCSVField((ex as { category: string }).category),
      escapeCSVField((ex as { difficulty: string }).difficulty),
      escapeCSVField(muscles),
    ].join(",")
  })

  return [header, ...rowLines].join("\n")
}
