# Choose Life implementation plans

Plan 001 was generated October 14, 2026 for one cloud coding session. Plans 002–004 were selected October 16, 2026 after a read-only Supabase audit and written with the improve and planning skills. Each numbered plan is a self-contained executor handoff.

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-hosted-slackdata-webbings.md) | Integrate hosted SlackData webbing selection into mobile | P1 | L | None | IMPLEMENTED — VERIFICATION PENDING (native checklist not run; see [notes](001-hosted-slackdata-webbings.notes.md)) |
| [002](002-supabase-verification-foundation.md) | Establish isolated Supabase verification and one CLI toolchain | P1 | M | None | DONE: local gates and all four Sol reviews accepted; hosted CI unobserved |
| [003](003-supabase-baseline-and-types.md) | Reconcile the Supabase baseline and restore complete generated types | P1 | M | 002 | IN PROGRESS: clean baseline accepted; catalog comparison next |
| [004](004-supabase-declarative-adoption.md) | Adopt declarative Supabase schemas with independent parity checks | P1 | L | 002, 003 | TODO |

## Execution order

For Plan 001, execute its internal checkpoints end to end in one session. Do not split that webbing integration into independent plans or assume the cloud executor can see the original chat or sibling SlackData repository. All decisions, API research, contracts, paths, tests, failure behavior, and finish conditions are in that plan.

The executor creates `001-hosted-slackdata-webbings.notes.md` and records code changes, deviations, passed checks, and unavailable verification. Use IMPLEMENTED — VERIFICATION PENDING when code checks pass but SQL/native gates cannot run; do not mark full verification DONE prematurely.

For Supabase, execute 002, then 003, then 004. Plan 002 adds isolated replay/tests and safe generation; its default CI gate intentionally leaves known type drift non-gating. Plan 003 reconciles the baseline, regenerates the complete artifact and makes type drift blocking. Plan 004 depends on both gates and adds declarative authoring, independent catalog parity and a no-op sync check. Plan 001's remaining native checklist does not block this sequence.

The user authorized dedicated-worktree execution with Opus 5.5 High and a fresh GPT Sol review after every numbered step. Current routing, checkpoint/task IDs and acceptance evidence are tracked in the [orchestration log](supabase-implementation.orchestration.md).

Every Supabase executor creates its own `<plan-basename>.notes.md` with `## Deviations` and `## How the run ended`, records commands/exit codes and updates only its own status row. Expected predecessor edits are accounted for by each dependent plan's prerequisite contract. Mark BLOCKED with the exact missing capability when required replay, staging comparison or parity verification cannot be completed; preserve independent work without claiming full completion.

The selected Supabase plans do not authorize hosted deployment, migration-history repair or resetting the developer's existing database. They use owned disposable databases for mutations. The [research report](supabase-declarative-schema.research.md) records the original evidence and audit limits; it is background, not a substitute for the self-contained numbered plans.

## Decisions replacing earlier proposals

- Native iOS/Android direct calls to hosted SlackData; no required proxy or Expo web.
- Selected-model snapshot on each physical webbing, not imports into the shared legacy model catalog.
- No persistent full-catalog cache or automatic snapshot refresh.
- Unknown unsupported lifetime, preserved usage/history, personal static images.

## Findings considered and rejected or deferred

### Supabase workflow

- Duplicate generated type copies across web/mobile/Edge: rejected; they re-export the single shared source.
- Missing meaningful SQL tests: rejected; the missing capability is an active reproducible gate for the existing suites.
- An outstanding dead renewal cron in the final schema: rejected; the reconciliation migration removes it and inspected staging has only the three intended festival jobs. The README is stale.
- Blind export of the existing local database: rejected; it contained an unpublished ISA-link table. Migration replay is the baseline, with current committed changes reconciled at execution time.
- Squashing/rewriting applied history or activating nested deployment workflows: outside the selected scope and unnecessary for declarative authoring.
- An established active Storage upload vulnerability: not demonstrated; app media uses R2, and legacy Storage ownership needs separate investigation.
- Broad runtime security/performance work, an ORM migration, billing redesign, new webhook delivery and production rollout: deferred to separate work.

### Hosted SlackData integration

- Self-hosting SlackData or copying seed files: conflicts with the user's explicit scope.
- New public API, API keys, SDK, or upstream UUID migration: existing public reads and explicit upstream IDs already exist.
- Mandatory backend proxy: unnecessary for native-only access.
- Broad legacy material/weave enum migration: unnecessary with validated selected snapshots.
- Permanent catalog synchronization or refresh feature: explicitly deferred by the user.
- All-gear inventory redesign, global auth/cache overhaul, unrelated framework upgrades: outside the webbing integration.
- Assume catalog certification determines a physical item's condition or lifetime: unsupported.
- Claim source inspection/unit tests prove native rendering or production DB migration: invalid; verification gates remain explicit.
