// ACD-90: proves staff/profiles read access is directory-wide (any
// authenticated role) while writes stay admin-only — see
// supabase/migrations/20260928120000_client_staff_assignment_rls.sql.
//
// NOTE on `profiles`: the migration gives `profiles` a "select all" policy
// but adds ZERO insert/update/delete policies for anyone, including admin
// (see supabase/migrations/20260714221150_profiles_table.sql — role changes
// are service-role/dashboard-only by design). The ACD-90 acceptance
// criteria describes this as "only admin can ... change a profiles.role",
// but the actual implementation is stricter: nobody can change it via the
// client API, not even admin. The test below asserts the real, stricter
// behavior. Flag this to product/eng if the intent is for admins to be able
// to change roles from within the app — that would need a new admin-only
// policy or an RPC, neither of which exists yet.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { seed, teardown, clientFor, adminClient } from './setup.js'

let fixtures
let adminUser, bcbaUser

before(async () => {
  fixtures = await seed()
  const { emails } = fixtures.users
  adminUser = await clientFor(emails.admin, fixtures.password)
  bcbaUser = await clientFor(emails.bcba, fixtures.password)
})

after(async () => {
  await teardown(fixtures)
})

test('any authenticated role can select all staff rows', async () => {
  const { data, error } = await bcbaUser.from('staff').select('id, user_id')
  assert.equal(error, null)
  const seenUserIds = data.map((r) => r.user_id)
  for (const userId of [fixtures.users.admin, fixtures.users.bcba, fixtures.users.bcaba, fixtures.users.rbt]) {
    assert.ok(seenUserIds.includes(userId), `expected to see fixture staff row for ${userId}`)
  }
})

test('any authenticated role can select all profiles rows', async () => {
  const { data, error } = await bcbaUser.from('profiles').select('id, role')
  assert.equal(error, null)
  const seenIds = data.map((r) => r.id)
  assert.ok(seenIds.includes(fixtures.users.admin))
  assert.ok(seenIds.includes(fixtures.users.rbt))
})

test('non-admin cannot insert a staff row', async () => {
  const { error } = await bcbaUser.from('staff').insert({ name: 'rls-unauthorized', role: 'rbt' })
  assert.ok(error, 'expected non-admin staff insert to be rejected')
})

test('non-admin UPDATE on a staff row has no effect', async () => {
  const before_ = await adminClient.from('staff').select('status').eq('user_id', fixtures.users.rbt).single()
  await bcbaUser.from('staff').update({ status: 'inactive' }).eq('user_id', fixtures.users.rbt)
  const after_ = await adminClient.from('staff').select('status').eq('user_id', fixtures.users.rbt).single()
  assert.equal(after_.data.status, before_.data.status, 'non-admin update must not change the row')
})

test('non-admin DELETE on a staff row has no effect', async () => {
  const before_ = await adminClient.from('staff').select('id').eq('user_id', fixtures.users.rbt).maybeSingle()
  await bcbaUser.from('staff').delete().eq('user_id', fixtures.users.rbt)
  const after_ = await adminClient.from('staff').select('id').eq('user_id', fixtures.users.rbt).maybeSingle()
  assert.ok(after_.data, 'non-admin delete must not remove the staff row')
})

test('admin CAN update a staff row', async () => {
  const { error } = await adminUser.from('staff').update({ title: 'RLS Test Title' }).eq('user_id', fixtures.users.rbt)
  assert.equal(error, null)
  const check = await adminClient.from('staff').select('title').eq('user_id', fixtures.users.rbt).single()
  assert.equal(check.data.title, 'RLS Test Title')
})

test('admin, like everyone else, cannot change profiles.role via the client API', async () => {
  const before_ = await adminClient.from('profiles').select('role').eq('id', fixtures.users.rbt).single()
  await adminUser.from('profiles').update({ role: 'admin' }).eq('id', fixtures.users.rbt)
  const after_ = await adminClient.from('profiles').select('role').eq('id', fixtures.users.rbt).single()
  assert.equal(after_.data.role, before_.data.role, 'profiles.role must not be client-writable by anyone, including admin')
})
