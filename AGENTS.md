# GymFlow — Codex project rules

## Commits

- Use Conventional Commits only.
- Never add `Co-Authored-By` or AI attribution.
- Before committing, use the `work-unit-commits` skill.

## Build

- Never run `npm run build` unless the user explicitly asks.
- Use `npx tsc --noEmit` for type verification.

## Testing — mandatory

When an implementation changes behavior, old passing tests are not enough.
Update or add tests that lock the new behavior in the same work unit as the code change.

If the changed code is tightly coupled to Supabase, `fetch`, framework runtime, webhooks, or another external API, extract the decision logic into a pure module under `lib/` and test it there.

## Supabase / DB

- Read the real database before changing code that depends on schema, RLS, RPCs, grants, cron, or payment behavior.
- Apply remote migrations with `supabase db query --linked -f <file>`; never use `supabase db push` for this project because remote migration history is not populated.
- SECURITY DEFINER functions must explicitly revoke `PUBLIC`/`anon` unless browser roles genuinely need them.
- RLS policies and grants must be verified with SQL, not assumed.
