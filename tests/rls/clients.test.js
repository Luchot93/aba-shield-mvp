// ACD-90: proves the role-scoped RLS model on `clients` (admin sees all;
// assigned BCBA/RBT see only their own; unassigned staff see nothing; only
// an admin may reassign bcba_id/rbt_id) against a real Postgres instance —
// see supabase/migrations/20260928120000_client_staff_assignment_rls.sql.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { seed, teardown, clientFor } from './setup.js'

let fixtures
let adminUser, bcbaUser, bcabaUser, rbtUser

before(async () => {
  fixtures = await seed()
  const { emails } = fixtures.users
  adminUser = await clientFor(emails.admin, fixtures.password)
  bcbaUser = await clientFor(emails.bcba, fixtures.password)
  bcabaUser = await clientFor(emails.bcaba, fixtures.password)
  rbtUser = await clientFor(emails.rbt, fixtures.password)
})

after(async () => {
  await teardown(fixtures)
})

test('admin can select both fixture clients', async () => {
  const { data, error } = await adminUser
    .from('clients')
    .select('id')
    .in('id', [fixtures.clients.assigned.id, fixtures.clients.other.id])
  assert.equal(error, null)
  assert.equal(data.length, 2)
})

test('assigned BCBA sees only their own client — zero rows, not an error, for the other', async () => {
  const own = await bcbaUser.from('clients').select('id').eq('id', fixtures.clients.assigned.id)
  assert.equal(own.error, null)
  assert.equal(own.data.length, 1)

  const other = await bcbaUser.from('clients').select('id').eq('id', fixtures.clients.other.id)
  assert.equal(other.error, null)
  assert.equal(other.data.length, 0)
})

test('assigned RBT sees only their own client — zero rows, not an error, for the other', async () => {
  const own = await rbtUser.from('clients').select('id').eq('id', fixtures.clients.assigned.id)
  assert.equal(own.error, null)
  assert.equal(own.data.length, 1)

  const other = await rbtUser.from('clients').select('id').eq('id', fixtures.clients.other.id)
  assert.equal(other.error, null)
  assert.equal(other.data.length, 0)
})

test('BCaBA with no assignment gets zero rows for both clients', async () => {
  const { data, error } = await bcabaUser
    .from('clients')
    .select('id')
    .in('id', [fixtures.clients.assigned.id, fixtures.clients.other.id])
  assert.equal(error, null)
  assert.equal(data.length, 0)
})

test('non-admin UPDATE of bcba_id/rbt_id on their own assigned client is rejected by the A1 trigger', async () => {
  const { error } = await bcbaUser
    .from('clients')
    .update({ rbt_id: fixtures.users.bcaba })
    .eq('id', fixtures.clients.assigned.id)
  assert.ok(error, 'expected the reassignment attempt to be rejected')
  assert.match(error.message, /only an admin can reassign/i)
})

test('non-admin CAN update other fields on their own assigned client', async () => {
  const { data, error } = await bcbaUser
    .from('clients')
    .update({ stage: 'rls_test_stage' })
    .eq('id', fixtures.clients.assigned.id)
    .select('stage')
  assert.equal(error, null)
  assert.equal(data[0].stage, 'rls_test_stage')
})
