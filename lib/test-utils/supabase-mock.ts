import { vi } from "vitest"

export type MockResult = { data: unknown; error: unknown }

/**
 * Query builder de Supabase encadenable para tests. Cada mÃ©todo de
 * filtro/modificaciÃ³n devuelve el mismo objeto (para seguir encadenando);
 * tanto los mÃ©todos terminales (.single()/.maybeSingle()) como el await
 * directo del builder (cuando el cÃ³digo no llama a ninguno de los dos,
 * como `.update(...).eq(...)` sin `.single()`) resuelven al mismo
 * resultado configurado.
 */
export function chainableResult(result: MockResult) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    or: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: MockResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

/**
 * Mock de un cliente Supabase completo. `fromResults` es la lista de
 * resultados que devuelve cada llamada sucesiva a `.from(...)`, EN ORDEN â€”
 * hay que conocer cuÃ¡ntas veces y en quÃ© orden la funciÃ³n bajo test llama
 * a `.from()`, incluyendo llamadas indirectas (por ejemplo,
 * getMemberProfileForPlan llamando a su propio createClient() adentro de
 * otra funciÃ³n que ya llamÃ³ la suya).
 *
 * `mockSupabase.chains[i]` guarda el builder devuelto por la i-Ã©sima
 * llamada a `.from()`, asÃ­ un test puede assertar sobre quÃ© se le pasÃ³ a
 * `.insert()`/`.update()`/`.upsert()` en esa llamada puntual.
 *
 * `.rpc(...)` es independiente de `.from(...)` â€” se configura aparte con
 * `mockSupabase.rpc.mockResolvedValueOnce({ data, error })` en cada test
 * que lo necesite. Devuelve `{ data: null, error: null }` por defecto.
 */
export function createMockSupabase(fromResults: MockResult[] = []) {
  const chains = fromResults.map(chainableResult)
  let call = 0
  const from = vi.fn(() => {
    const chain = chains[call] ?? chainableResult({ data: null, error: null })
    call++
    return chain
  })
  return {
    from,
    auth: { getUser: vi.fn() },
    rpc: vi.fn((): Promise<MockResult> => Promise.resolve({ data: null, error: null })),
    chains,
  }
}

