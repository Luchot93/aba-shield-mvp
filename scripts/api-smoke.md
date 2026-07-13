# API Smoke Test — post-deploy manual checks

Run these **4 manual checks against production after any API deploy** that touches
`api/generate.js`, `api/generate-definition.js`, or `api/_lib/verifyAuth.js`.

This is a **manual checklist, not an automated script** — copy/paste each curl and
eyeball the status code. Only check 2 spends money (~1 cent), and that is acceptable.

Both AI endpoints call `verifyAuth()` before touching Anthropic, so an unauthenticated
POST is rejected with **401** *before* any tokens are burned. The method guard
(`if (req.method !== 'POST') return res.status(405)`) runs first, so a wrong verb
returns **405** even without a token.

---

## Setup

Set your production base URL once (replace with the real Vercel domain):

```bash
export BASE="https://YOUR-PROD-DOMAIN"     # e.g. https://aba-shield.vercel.app
```

---

## How to grab a session token from the browser

You must be **logged into the production app** in the browser first.

1. Open the production app and sign in.
2. Open DevTools (`Cmd+Option+I` on macOS / `F12`).
3. Go to the **Application** tab → left sidebar **Local Storage** → click the app's
   origin.
4. Find the key named **`sb-<project-ref>-auth-token`** (Supabase stores the session
   here; `<project-ref>` is the subdomain of your `VITE_SUPABASE_URL`).
5. The value is a JSON object. Copy the value of the **`access_token`** field
   (a long string starting with `eyJ...`). That is your bearer token.

Then export it in your terminal:

```bash
export TOKEN="eyJhbGciOi...paste-access_token-here..."
```

> The `access_token` is a short-lived JWT. If check 2 returns 401, the token has
> likely expired — refresh the app and grab a fresh one.

---

## Check 1 — POST /api/generate with NO auth header → expect **401**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$BASE/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"sectionKey":"smoke","sectionPrompt":"ping"}'
```

**Expected:** `401` (body: `{"error":"Unauthorized"}`). No Anthropic call is made.

---

## Check 2 — POST /api/generate with a valid token + tiny prompt → expect **200 + content**

> ⚠️ This one makes a real Anthropic call and costs **~1 cent**. Acceptable.

```bash
curl -s -w "\n%{http_code}\n" \
  -X POST "$BASE/api/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sectionKey":"smoke","sectionTitle":"Smoke Test","clientName":"Test","sectionPrompt":"Reply with the single word: OK"}'
```

**Expected:** `200` with a JSON body like `{"content":"OK"}` (the `content` string is
non-empty).

---

## Check 3 — POST /api/generate-definition without auth → expect **401**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$BASE/api/generate-definition" \
  -H "Content-Type: application/json" \
  -d '{"skillName":"tacting"}'
```

**Expected:** `401` (body: `{"error":"Unauthorized"}`). No Anthropic call is made.

---

## Check 4 — GET /api/generate → expect **405**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X GET "$BASE/api/generate"
```

**Expected:** `405` (the method guard rejects non-POST before auth runs, so no token
is needed to observe this).

---

## Pass criteria

| # | Request                                    | Expected |
|---|--------------------------------------------|----------|
| 1 | POST /api/generate, no auth                | 401      |
| 2 | POST /api/generate, valid token + prompt   | 200 + non-empty `content` |
| 3 | POST /api/generate-definition, no auth     | 401      |
| 4 | GET /api/generate                          | 405      |

If any check deviates, treat the deploy as **not verified** and investigate before
letting clinicians use it.
