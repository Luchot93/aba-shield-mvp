# Session Handoff

_Last updated: 2026-10-09_

## 1. Goal we are moving towards

ACD-94 ("E5: Turn on automated dependency and vulnerability scanning") — get
automatic alerts when a third-party package we depend on has a known
security vulnerability, instead of finding out the hard way. Scope: enable
Dependabot (scheduled update PRs + security alerts), add an `npm audit` gate
to CI that fails only on high/critical findings in production dependencies,
and document where to find/triage alerts going forward.

**Status: DONE, merged to `main` — deployed to production.**

- PR [#131](https://github.com/Luchot93/aba-shield-mvp/pull/131)
  (`ACD-94-dependency-vulnerability-scanning` → `dev`) merged.
- PR [#132](https://github.com/Luchot93/aba-shield-mvp/pull/132)
  (`dev` → `main`) merged.
- Jira ACD-94 commented (plain-English summary) and transitioned to **Done**.

## 2. Current state of the code

**Committed, merged into `dev` and `main`. No DB/backend changes — this
ticket is CI/repo-config + docs only, nothing to deploy to Supabase.**

- **New `.github/dependabot.yml`**: npm ecosystem, weekly schedule, PRs
  against `main`. Patch/minor bumps grouped into one weekly PR
  (`minor-and-patch` group); major bumps left ungrouped so each opens its own
  PR for manual review (more likely to need code changes).
- **`.github/workflows/ci.yml`**: added `npm audit --omit=dev
  --audit-level=high` after `npm ci`. Scoped to production dependencies only
  and to high/critical severity only, with an inline comment explaining both
  choices and pointing at the ticket below for the known exemption. Verified
  this passes cleanly today (0 findings in prod deps) while still failing
  if run unscoped — the exemption is real, not a no-op.
- **New `SECURITY.md`**: where alerts show up (Security tab, CI job log),
  the triage process, why the CI gate excludes devDependencies, and how to
  tighten the severity threshold later.
- **Repo settings enabled via GitHub API**: Dependabot vulnerability alerts
  and Dependabot automated security-fix PRs, both now on for this repo.

### What the first scan found (and what we did with it)

- Local `npm audit` on day one showed 9 pre-existing findings (6 high, 3
  moderate), all traced to the `tailwindcss`/`vite` **devDependency** chain
  (confirmed via `npm ls` + `package.json` — neither ships to production).
  Rather than block this ticket on fixing those, or landing a CI gate that's
  red from day one, the gate was scoped to `--omit=dev` and the dev-tooling
  upgrade was split into its own ticket (see below).
- Once Dependabot's repo-level alerts went live, they surfaced 3 *additional*
  Vite CVEs that local `npm audit` had missed (one high-severity:
  `server.fs.deny` bypass). All three confirmed `development`-scoped, zero
  production-scoped alerts on the repo — validates the CI gate's exemption
  boundary is correct, not just convenient.
- Enabling Dependabot's automated security fixes had a side effect:
  Dependabot auto-opened 3 individual security-fix PRs (#128, #129, #130)
  for that same Tailwind/Vite chain, bypassing the `dependabot.yml` grouping
  (grouping only applies to scheduled routine updates, not security-triggered
  ones). All three required the same breaking major-version upgrade as the
  ticket below, so they were closed (not merged) with comments pointing back
  to it, rather than merging a breaking change blind.

### New ticket created this session

- **[ACD-115](https://awcbehavioralhealth.atlassian.net/browse/ACD-115)** —
  "Upgrade Tailwind CSS and Vite to resolve high-severity devDependency
  vulnerabilities." Status: **To Do**, unassigned. Covers both the original
  `npm audit` findings and the 3 extra Dependabot-only Vite CVEs (with their
  alert numbers and CVE/GHSA IDs documented in the ticket). Acceptance
  criteria requires both `npm audit --omit=dev` *and* the repo's Dependabot
  alerts tab to be clear. This is the next real piece of work from this
  session's area — not started yet.

## 3. Files actively being edited

None — everything is committed, pushed, merged into `dev` and `main`. Only
this file (`handoff.md`) is being touched now.

## 4. Everything tried that failed / walked back — and deferred items

- **Nothing walked back this session** — the CI-gate scoping (prod-only,
  high/critical-only) was the plan from the start, confirmed via plain-English
  discussion with the user before writing any code, not a correction after
  a failed attempt.
- **Deferred, now tracked**: the Tailwind/Vite breaking upgrade itself
  (ACD-115, above) — explicitly out of scope for this ticket per user
  instruction, left as its own ticket rather than attempted ad-hoc.
- **Deferred, not newly tracked**: moderate/low-severity `npm audit`
  findings are visible (locally and in Dependabot) but intentionally don't
  block CI yet — there's a pre-existing backlog too large to start there.
  `SECURITY.md` documents how to tighten `--audit-level` once that backlog
  is addressed; no ticket opened for this yet since it's documented inline
  as a known, intentional gap rather than an untracked one.

## 5. Next steps

1. **ACD-115** (Tailwind/Vite major-version upgrade) — unstarted. Needs a
   breaking-change evaluation (Tailwind v3→v4 and/or Vite major bump) before
   merging; the 3 closed Dependabot PRs (#128/#129/#130) are left as a
   reference starting point, not meant to be reopened/merged as-is.
2. Carried over from ACD-92's handoff, still unstarted — **the follow-up
   re-test of `manage-staff`'s invite happy-path** once this Supabase
   project's invite emails aren't rate-limited (commented on ACD-92
   already, not a new ticket).
3. **ACD-101** (DNS/Resend domain verification) — still To Do, unassigned,
   still blocked on owning/controlling a real domain. Unchanged.
4. This sprint's actual stated focus (per user, 2026-10-08, carried over
   across the last several sessions) is still **Staff, CRM Pipeline + new
   service checklist, and the standalone service session logs feature** —
   none of that has been touched in the ACD-92/ACD-93/ACD-94 sessions;
   fully unstarted from here.
5. Carried forward, unrelated to ACD-94 (pointer only, not reproduced here):
   the `openClientTab` Playwright helper bug, and everything from the
   ACD-82 through ACD-92 handoffs' outstanding items (ACD-113, ACD-112,
   ACD-111, ACD-109, ACD-110, ACD-100, ACD-105, ACD-106, ACD-99, the
   `FLAGS.PIPELINE` flip-gated QA items, and the `suggestFromLabel` fallback
   note) — see git history for earlier handoff versions if needed.
