# Git Workflow

The branching and release flow for `aba-shield-mvp`.

## Branches

- **`main`** — production. Deploys to Vercel production. Never commit directly.
- **`dev`** — the day-to-day working branch. All routine work happens here.

## Daily flow

1. Work on `dev` (or a short-lived feature branch cut from `dev`).
2. Push `dev` to origin.
3. Open a **PR into `main`**.
4. **CI must pass** — the GitHub Actions build check (`.github/workflows/ci.yml`)
   runs `npm ci && npm run build` on every PR.
5. Review the **Vercel preview URL** that Vercel posts on the PR.
6. **Verify** the preview (golden path + the change you made).
7. **Merge** the PR → `main` → Vercel deploys to **production**.

## Hotfix flow

For an urgent production fix that can't wait behind `dev`:

1. `git checkout main && git pull`
2. `git checkout -b hotfix/<short-name>`
3. Fix, push, open a PR into `main`.
4. CI passes → verify Vercel preview → merge → production.
5. Bring the fix back into `dev`: `git checkout dev && git merge main`.

## Rules

- **Commits are always manual.** Nothing is committed or pushed without an explicit ask.
- Don't commit directly to `main` — always go through a PR.
- Keep `dev` current with `main` after each merge (`git merge main` from `dev`).

## Follow-up

- **Enable branch protection on `main`** once this lands: require the CI check to
  pass and require a PR before merging. (Tracked as a separate manual task.)
