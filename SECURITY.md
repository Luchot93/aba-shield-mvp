# Security & Dependency Scanning

## Where alerts show up

- **Dependabot alerts**: repo → **Security** tab → **Dependabot alerts**. This is the
  single place to see and triage known vulnerabilities in our dependencies. Dependabot
  alerts and automated security-update PRs are both enabled on this repo.
- **CI audit gate**: every push/PR runs `npm audit --omit=dev --audit-level=high` in
  [`.github/workflows/ci.yml`](.github/workflows/ci.yml). A red CI check means a new
  **high or critical** vulnerability landed in a *production* dependency — check the
  job log for the affected package and advisory link.

## Triage process

1. New Dependabot alert or red CI check appears → review the advisory (severity, whether
   it's reachable in our usage, fix availability).
2. Routine patch/minor version bumps: Dependabot opens a weekly grouped PR
   (see [`.github/dependabot.yml`](.github/dependabot.yml)) — review and merge like any
   other PR.
3. Major version bumps are opened individually (not grouped) since they're more likely to
   need code changes — evaluate breaking changes before merging.
4. If a fix requires a breaking upgrade that's out of scope for a quick merge, open a
   tracking ticket instead of leaving the alert unaddressed silently (e.g.
   [ACD-115](https://awcbehavioralhealth.atlassian.net/browse/ACD-115) for the
   Tailwind/Vite devDependency chain known at the time this was written).

## Why the CI gate is scoped to production dependencies

`devDependencies` (build tooling — Vite, Tailwind, etc.) are excluded from the CI audit
gate (`--omit=dev`). They never ship in the production bundle, and gating on them
couples build-tool hygiene to every PR's CI status. Known devDependency vulnerabilities
are tracked and resolved as their own tickets instead (see ACD-115 above). Production
dependencies — code that actually ships to users — are not exempted.

## Adjusting the severity threshold

`--audit-level=high` only fails CI on high/critical findings. Moderate/low findings are
visible in `npm audit` output locally and in Dependabot alerts, but don't block builds
yet — there were too many pre-existing ones to start there. Tighten this in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) once the moderate/low backlog is
addressed.
