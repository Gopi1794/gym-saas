import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true, // resuelve los imports "@/..." con el mismo mapeo de tsconfig.json
  },
  test: {
    environment: "node", // sin jsdom: por ahora solo testeamos funciones puras, no componentes
    include: ["**/*.test.ts"],
  },
})
