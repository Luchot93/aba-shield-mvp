// tests/rls/setup.js — not a test file. Shared fixture seeding/teardown for
// the tests/rls/*.test.js suite (ACD-90). This is the ONLY place that uses
// the service-role client: it bypasses RLS entirely, so it can prove nothing
// about whether RLS is actually enforcing scoping. Every assertion in the
// *.test.js files must run through clientFor(), which signs in as a real
// fixture user and hits the API exactly as that user would.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: ANON_KEY,
})) {
  if (!value) {
    throw new Error(`tests/rls requires ${name} to be set — see tests/rls/README.md`)
  }
}

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Signs in as a fixture user via a fresh anon-key client, so assertions made
// against the returned client are real RLS-enforced API calls, not
// service-role bypasses.
export async function clientFor(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`fixture sign-in failed for ${email}: ${error.message}`)
  return client
}

async function createFixtureUser(email, role) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`failed to create fixture user ${email}: ${error.message}`)
  const userId = data.user.id

  // handle_new_user() already inserted a `profiles` row with the default
  // role 'bcba'. profiles has zero insert/update/delete policies for ANYONE
  // via the client API, including admin (service-role/dashboard only — see
  // supabase/migrations/20260714221150_profiles_table.sql), so this role
  // update must go through the service-role client.
  if (role !== 'bcba') {
    const { error: profileError } = await adminClient.from('profiles').update({ role }).eq('id', userId)
    if (profileError) throw new Error(`failed to set role for ${email}: ${profileError.message}`)
  }

  // Promoting to admin auto-creates a matching `staff` row via
  // handle_admin_promoted() (20260929120000_auto_create_admin_staff_row.sql).
  // That trigger is admin-only, so bcba/bcaba/rbt need their staff row
  // inserted here. onConflict + ignoreDuplicates makes this a no-op for the
  // admin fixture, whose row the trigger already created.
  const { error: staffError } = await adminClient
    .from('staff')
    .upsert({ user_id: userId, name: email, role, status: 'active' }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (staffError) throw new Error(`failed to create staff row for ${email}: ${staffError.message}`)

  return userId
}

const FIXTURE_PASSWORD = `rls-test-${randomUUID()}`

// Seeds one admin, one BCBA, one BCaBA, one RBT fixture user, plus two
// clients: "assigned" (bcba_id/rbt_id = the fixture BCBA/RBT) and "other".
// "other" deliberately reuses the admin fixture's id as both bcba_id and
// rbt_id, rather than seeding a 5th throwaway staff member, purely to give
// it a valid, FK-satisfying assignment that is provably NOT the BCBA/RBT
// fixture pair. Admin visibility is governed entirely by is_admin() and is
// unaffected by which id sits in these columns, so this has no bearing on
// what the admin-visibility assertions actually check.
export async function seed() {
  const runId = randomUUID().slice(0, 8)
  const emails = {
    admin: `rls-admin-${runId}@test.abashield.local`,
    bcba: `rls-bcba-${runId}@test.abashield.local`,
    bcaba: `rls-bcaba-${runId}@test.abashield.local`,
    rbt: `rls-rbt-${runId}@test.abashield.local`,
  }

  const users = {}
  for (const [role, email] of Object.entries(emails)) {
    users[role] = await createFixtureUser(email, role)
  }

  const { data: clientRows, error: clientError } = await adminClient
    .from('clients')
    .insert([
      { name: `RLS Fixture Client A (${runId})`, user_id: users.admin, bcba_id: users.bcba, rbt_id: users.rbt },
      { name: `RLS Fixture Client B (${runId})`, user_id: users.admin, bcba_id: users.admin, rbt_id: users.admin },
    ])
    .select('id')
  if (clientError) throw new Error(`failed to seed clients: ${clientError.message}`)
  const [assigned, other] = clientRows

  const childInserts = []
  for (const client of [assigned, other]) {
    childInserts.push(
      adminClient.from('checklist_items').insert({ client_id: client.id, stage: 'intake', item_key: 'rls_fixture_item' }),
      adminClient.from('documents').insert({ client_id: client.id, storage_path: `${client.id}/rls-fixture.pdf`, file_name: 'rls-fixture.pdf' }),
      adminClient.from('activity_log').insert({ client_id: client.id, actor_id: users.admin, action: 'rls_fixture_seeded' })
    )
  }
  const childResults = await Promise.all(childInserts)
  const failed = childResults.find((r) => r.error)
  if (failed) throw new Error(`failed to seed child rows: ${failed.error.message}`)

  return {
    runId,
    password: FIXTURE_PASSWORD,
    users: { ...users, emails },
    clients: { assigned, other },
  }
}

// Deletes the two fixture clients (cascades to checklist_items/documents/
// activity_log via `on delete cascade`), then the four fixture staff rows
// (no cascade on staff.user_id — must go first or deleteUser() below fails
// on a foreign key violation), then the four fixture auth.users (cascades to
// profiles).
export async function teardown(fixtures) {
  if (!fixtures) return
  const clientIds = [fixtures.clients.assigned.id, fixtures.clients.other.id]
  const userIds = Object.values(fixtures.users).filter((v) => typeof v === 'string' && v.length === 36)

  await adminClient.from('clients').delete().in('id', clientIds)
  await adminClient.from('staff').delete().in('user_id', userIds)
  for (const userId of userIds) {
    await adminClient.auth.admin.deleteUser(userId)
  }
}
