import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true, // resuelve los imports "@/..." con el mismo mapeo de tsconfig.json
  },
  test: {
    environment: "jsdom", // necesario para testing React components
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true, // describe, it, expect sin imports
    setupFiles: ["./vitest.setup.ts"],
  },
})
