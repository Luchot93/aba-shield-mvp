# ACD-41 — Auth Hardening Audit

Read-only audit of the authentication surface, re-run after the real invite →
set-password flow landed (see the accompanying `feat(ACD-41)` change). The first
pass found a single gap — the demo invite stub — which is now resolved. All five
checks pass.

## Findings

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Role strings read/compared in `src/`; flag any `user_metadata` role reads | PASS | Role is read authoritatively from the `profiles` table via `getProfile()` (`src/App.jsx` `resolveUser`). The only `user_metadata` mention is a comment stating it is never used. Other role reads (`isAdmin(currentUser.role)` in pipeline/staff) are gated Phase 2 code (`FLAGS.PIPELINE` / `FLAGS.STAFF`). No fail-open metadata reads. |
| 2 | No page reachable when `currentUser` is null | PASS | Render gates run in order: invite gate returns `SetPasswordPage`; `authLoading` returns the spinner; `!currentUser` returns `LoginPage`. The main app render is only reachable with a truthy `currentUser`. Profile-fetch failure fails closed (`signOut()` + `setCurrentUser(null)`). |
| 3 | Built `dist/` contains zero `service_role` | PASS | `npm run build` then `grep -rc service_role dist/` returns 0. Only the anon key / project URL are bundled (public by design). |
| 4 | `SetPasswordPage` handles expired/invalid invite gracefully (no blank screen) | PASS (fixed) | Was the one gap in the first pass (demo stub: blank screen on expired links, client-assigned `u3/bcaba` role, no Supabase call). Now uses `supabase.auth.updateUser({ password })`, enforces min-8 + match, shows a submit spinner, and renders an "Invite link expired" screen with a working Back-to-login button driven by `inviteError`. |
| 5 | Findings table | This table | — |

## Fail-closed model (item 1 detail)

`resolveUser()` in `src/App.jsx` reads the role from `profiles`, never from
`user_metadata` / `app_metadata`. If the profile row cannot be read, it signs the
user out and clears `currentUser` rather than assuming any role. The `profiles`
row is created automatically by the `on_auth_user_created` trigger (role default
`bcba`); an admin overrides the role in the Supabase Table Editor.

## Invite flow (item 4 detail)

The invite link creates a Supabase session immediately, so an invite-mode gate is
placed above the `authLoading` / `!currentUser` gates. Invite mode is detected
from the URL hash (`type=invite`) — what a real Supabase redirect always carries,
independent of Site URL — so production needs no `?invite=` suffix; `?invite=true`
remains for local/dev testing. The hash is captured by an inline script in
`index.html` before the module bundle loads, because the Supabase client consumes
and clears the hash (when it carries an `access_token`) during init.

## Scope

Read-only audit; no application code was changed while producing this report. The
underlying fix for item 4 ships in the same branch/PR as this document.
