# Commands
- `npm test` (vitest), `npm run build` (typecheck + build). Run both before each commit.

# Workflow
- Work in small steps: failing test → simplest code to pass → refactor → commit. Commit what + why, small and atomic.
- Leave code better than found: fix small issues you pass through.

# Principles
- Clarity over cleverness; solve today's requirement only (YAGNI/KISS).
- Fail fast and loud: throw a clear error at the point of failure. Never swallow errors; log operation + input + error. A script that "succeeds" after skipping bad rows is a bug.
- One job per function/file; the name says which.
- Duplication beats the wrong abstraction: extract on the third repeat, not before.

# Code rules
- Names: functions = verbs, vars = nouns, booleans = is/has/can, constants = UPPER_SNAKE. Only abbreviations: `id db req res`. Use `error`, not `err`/`e`.
- Guard clauses over nested if/else.
- No boolean params; use an options object or two functions.
- Comments say why, not what.
- Constants at top of file; no inline magic numbers/strings.

# Testing
- Test behavior/contract, never internals; never mock the thing under test.
- One behavior per test, named for it. Cover happy path, one realistic edge, one error path.
- Skip getters, pass-throughs, branchless one-liners.
- Snapshots only for rendered output, never data shapes.

# Hygiene
- No secrets. `.env` stays untracked; keep `.env.example` updated.
- Validate required env vars at startup and throw if missing.
- Delete dead code; git is the backup.
