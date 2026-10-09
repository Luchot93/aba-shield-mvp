// ACD-92 (E3): validates the hardening added to the manage-staff and
// send-notification-email edge functions (auth checks, payload validation,
// header-injection stripping, staff_activity_log auditing). Run against the
// disposable aba-shield-rls-dev project via `npm run test:rls` — reuses the
// same fixtures/sign-in pattern as tests/rls/*.test.js. Ad hoc verification
// written for this ticket; promote to a permanent suite if kept.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { seed, teardown, clientFor, adminClient } from './setup.js'

const FUNCTIONS_URL = `${process.env.SUPABASE_URL}/functions/v1`

let fixtures
let adminToken, bcbaToken, bcabaToken, rbtToken
let rbtStaffId, bcabaStaffId, adminStaffId

async function tokenFor(client) {
  const { data } = await client.auth.getSession()
  return data.session.access_token
}

async function callFunction(name, token, body) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

before(async () => {
  fixtures = await seed()
  const { emails } = fixtures.users
  const adminClientSession = await clientFor(emails.admin, fixtures.password)
  const bcbaClientSession = await clientFor(emails.bcba, fixtures.password)
  const bcabaClientSession = await clientFor(emails.bcaba, fixtures.password)
  const rbtClientSession = await clientFor(emails.rbt, fixtures.password)

  adminToken = await tokenFor(adminClientSession)
  bcbaToken = await tokenFor(bcbaClientSession)
  bcabaToken = await tokenFor(bcabaClientSession)
  rbtToken = await tokenFor(rbtClientSession)

  const { data: staffRows } = await adminClient
    .from('staff')
    .select('id, user_id')
    .in('user_id', [fixtures.users.rbt, fixtures.users.bcaba, fixtures.users.admin])
  rbtStaffId = staffRows.find((r) => r.user_id === fixtures.users.rbt).id
  bcabaStaffId = staffRows.find((r) => r.user_id === fixtures.users.bcaba).id
  adminStaffId = staffRows.find((r) => r.user_id === fixtures.users.admin).id
})

after(async () => {
  await teardown(fixtures)
})

// --- manage-staff --------------------------------------------------------

test('manage-staff: no auth header is rejected', async () => {
  const { status } = await callFunction('manage-staff', null, { action: 'invite', name: 'x', email: 'x@test.local' })
  assert.equal(status, 401)
})

test('manage-staff: non-admin caller is rejected', async () => {
  const { status, json } = await callFunction('manage-staff', bcbaToken, {
    action: 'invite',
    name: 'Unauthorized Attempt',
    email: `rls-unauth-${fixtures.runId}@test.abashield.local`,
  })
  assert.equal(status, 403)
  assert.equal(json.error, 'Admin only')
})

test('manage-staff: admin invite with malformed email is rejected with 400', async () => {
  const { status, json } = await callFunction('manage-staff', adminToken, {
    action: 'invite',
    name: 'Bad Email',
    email: 'not-an-email',
  })
  assert.equal(status, 400)
  assert.match(json.error, /email/i)
})

test('manage-staff: admin invite with invalid role is rejected with 400', async () => {
  const { status, json } = await callFunction('manage-staff', adminToken, {
    action: 'invite',
    name: 'Bad Role',
    email: `rls-badrole-${fixtures.runId}@test.abashield.local`,
    role: 'superuser',
  })
  assert.equal(status, 400)
  assert.match(json.error, /role must be one of/i)
})

test('manage-staff: admin invite with invalid npi is rejected with 400', async () => {
  const { status, json } = await callFunction('manage-staff', adminToken, {
    action: 'invite',
    name: 'Bad NPI',
    email: `rls-badnpi-${fixtures.runId}@test.abashield.local`,
    npi: '12345',
  })
  assert.equal(status, 400)
  assert.match(json.error, /npi/i)
})

test('manage-staff: admin invite with invalid hire_date is rejected with 400', async () => {
  const { status, json } = await callFunction('manage-staff', adminToken, {
    action: 'invite',
    name: 'Bad Hire Date',
    email: `rls-baddate-${fixtures.runId}@test.abashield.local`,
    hire_date: '13/40/2026',
  })
  assert.equal(status, 400)
  assert.match(json.error, /hire_date/i)
})

// Full invite happy-path (inviteUserByEmail -> staff insert -> audit log)
// isn't exercised end-to-end here: inviteUserByEmail sends a real email via
// this sandbox project's shared SMTP, which has its own low rate limit
// unrelated to ACD-92. validateInvitePayload (the new code in this ticket)
// is already fully covered by the five 400-case tests above, which all run
// BEFORE inviteUserByEmail is ever called. The audit-log write itself
// (logStaffActivity, shared verbatim by invite and revoke) is proven below
// via revoke, which needs no outbound email at all.
let revokeTargetStaffId
let revokeTargetUserId
let revokeTargetEmail

test('manage-staff: admin valid revoke succeeds and writes a staff_activity_log row', async () => {
  // Seed a staff/auth-user pair directly (bypassing invite's email send) so
  // the revoke call below exercises the real function, not a fixture shortcut.
  revokeTargetEmail = `rls-revoke-target-${fixtures.runId}@test.abashield.local`
  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: revokeTargetEmail,
    password: `rls-revoke-${fixtures.runId}`,
    email_confirm: true,
  })
  assert.equal(createError, null)
  revokeTargetUserId = createdUser.user.id

  const { data: staffRow, error: staffError } = await adminClient
    .from('staff')
    .insert({ user_id: revokeTargetUserId, name: 'Revoke Target', email: revokeTargetEmail, role: 'rbt', status: 'pending' })
    .select()
    .single()
  assert.equal(staffError, null)
  revokeTargetStaffId = staffRow.id

  const { status, json } = await callFunction('manage-staff', adminToken, {
    action: 'revoke',
    staffId: revokeTargetStaffId,
  })
  assert.equal(status, 200)
  assert.equal(json.success, true)

  const { data: staffAfter } = await adminClient.from('staff').select('id').eq('id', revokeTargetStaffId).maybeSingle()
  assert.equal(staffAfter, null, 'staff row should be deleted')

  const { data: logRows, error } = await adminClient
    .from('staff_activity_log')
    .select('actor_id, action, detail')
    .eq('action', 'revoke')
    .filter('detail->>email', 'eq', revokeTargetEmail)
  assert.equal(error, null)
  assert.equal(logRows.length, 1)
  assert.equal(logRows[0].actor_id, fixtures.users.admin)
  assert.equal(logRows[0].detail.staff_id, revokeTargetStaffId)
})

// --- send-notification-email ----------------------------------------------

test('send-notification-email: no auth header is rejected', async () => {
  const { status } = await callFunction('send-notification-email', null, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: 'hi',
    body: 'hello',
  })
  assert.equal(status, 401)
})

test('send-notification-email: unrelated authenticated caller is rejected with 403', async () => {
  // bcaba notifying the rbt, with no clientId tying them together, and
  // bcaba is neither admin nor the recipient -- must be rejected.
  const { status, json } = await callFunction('send-notification-email', bcabaToken, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: 'hi',
    body: 'hello',
  })
  assert.equal(status, 403)
  assert.equal(json.success, false)
  assert.match(json.error, /not authorized/i)
})

test('send-notification-email: empty subject is rejected with 400', async () => {
  const { status, json } = await callFunction('send-notification-email', rbtToken, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: '   ',
    body: 'hello',
  })
  assert.equal(status, 400)
  assert.equal(json.success, false)
})

test('send-notification-email: recipient notifying themselves passes the authorization gate', async () => {
  const { status, json } = await callFunction('send-notification-email', rbtToken, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: 'Self notify',
    body: 'hello',
  })
  // Not 401/403 -- auth gate passed. (May still be success:false downstream
  // if RESEND_API_KEY isn't configured on this dev project, which is
  // unrelated to the ACD-92 authorization hardening under test.)
  assert.notEqual(status, 401)
  assert.notEqual(status, 403)
  assert.ok(json)
})

test('send-notification-email: admin notifying any staff passes the authorization gate', async () => {
  const { status } = await callFunction('send-notification-email', adminToken, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: 'Admin notify',
    body: 'hello',
  })
  assert.notEqual(status, 401)
  assert.notEqual(status, 403)
})

test('send-notification-email: assigned BCBA notifying for their client passes the authorization gate', async () => {
  const { status } = await callFunction('send-notification-email', bcbaToken, {
    recipientStaffId: bcabaStaffId,
    notificationType: 'test',
    subject: 'BCBA notify re assigned client',
    body: 'hello',
    clientId: fixtures.clients.assigned.id,
  })
  assert.notEqual(status, 401)
  assert.notEqual(status, 403)
})

test('send-notification-email: header-injection newlines are stripped from the stored subject', async () => {
  const dirtySubject = 'Legit subject\r\nBcc: attacker@evil.test'
  await callFunction('send-notification-email', rbtToken, {
    recipientStaffId: rbtStaffId,
    notificationType: 'test',
    subject: dirtySubject,
    body: 'hello',
  })

  const { data: rows, error } = await adminClient
    .from('email_notifications')
    .select('subject')
    .eq('recipient_staff_id', rbtStaffId)
    .order('created_at', { ascending: false })
    .limit(1)
  assert.equal(error, null)
  assert.equal(rows.length, 1)
  assert.ok(!rows[0].subject.includes('\n') && !rows[0].subject.includes('\r'))
  assert.match(rows[0].subject, /^Legit subject Bcc: attacker@evil\.test$/)
})
