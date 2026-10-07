// ACD-90: proves checklist_items, documents, and activity_log inherit the
// same admin/assigned/unassigned visibility rule as `clients`, via
// can_access_client() — see
// supabase/migrations/20260928130000_client_checklist_documents_activity.sql.
// Covers reads AND writes: an unassigned staff member must be rejected on a
// write attempt, not merely unable to see the row afterward.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { seed, teardown, clientFor } from './setup.js'

let fixtures
let adminUser, bcbaUser, bcabaUser

before(async () => {
  fixtures = await seed()
  const { emails } = fixtures.users
  adminUser = await clientFor(emails.admin, fixtures.password)
  bcbaUser = await clientFor(emails.bcba, fixtures.password)
  bcabaUser = await clientFor(emails.bcaba, fixtures.password)
})

after(async () => {
  await teardown(fixtures)
})

const TABLES = [
  {
    name: 'checklist_items',
    insertRow: (clientId, tag) => ({ client_id: clientId, stage: 'intake', item_key: `rls_write_${tag}` }),
  },
  {
    name: 'documents',
    insertRow: (clientId, tag) => ({ client_id: clientId, storage_path: `${clientId}/rls-write-${tag}.pdf` }),
  },
  {
    name: 'activity_log',
    insertRow: (clientId, tag) => ({ client_id: clientId, action: `rls_write_${tag}` }),
  },
]

for (const { name, insertRow } of TABLES) {
  describe(name, () => {
    test(`admin can select ${name} rows for both fixture clients`, async () => {
      const { data, error } = await adminUser
        .from(name)
        .select('id, client_id')
        .in('client_id', [fixtures.clients.assigned.id, fixtures.clients.other.id])
      assert.equal(error, null)
      assert.equal(data.length, 2)
    })

    test(`assigned BCBA sees only their own client's ${name} row`, async () => {
      const own = await bcbaUser.from(name).select('id').eq('client_id', fixtures.clients.assigned.id)
      assert.equal(own.error, null)
      assert.equal(own.data.length, 1)

      const other = await bcbaUser.from(name).select('id').eq('client_id', fixtures.clients.other.id)
      assert.equal(other.error, null)
      assert.equal(other.data.length, 0)
    })

    test(`unassigned BCaBA gets zero ${name} rows for either client`, async () => {
      const { data, error } = await bcabaUser
        .from(name)
        .select('id')
        .in('client_id', [fixtures.clients.assigned.id, fixtures.clients.other.id])
      assert.equal(error, null)
      assert.equal(data.length, 0)
    })

    test(`unassigned BCaBA write attempt into someone else's client is rejected, not just hidden`, async () => {
      const { error } = await bcabaUser.from(name).insert(insertRow(fixtures.clients.other.id, 'unassigned'))
      assert.ok(error, `expected ${name} insert for an unassigned client to be rejected`)
    })

    test(`assigned BCBA CAN write a new ${name} row for their own client`, async () => {
      const { error } = await bcbaUser.from(name).insert(insertRow(fixtures.clients.assigned.id, 'assigned'))
      assert.equal(error, null)
    })
  })
}
