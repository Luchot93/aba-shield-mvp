import { supabase } from './supabase.js'
import { IS_E2E } from './e2e/flag.js'
import * as store from './e2e/store.js'

const PHASE2_DEFAULTS = {
  assessment_session: null,
  service_session_logs: [],
  reassessment_sessions: [],
  caregiver_training_session_logs: [],
  documents: [],
  activity_log: [],
}

function enrichClient(row) {
  return { ...PHASE2_DEFAULTS, ...row }
}

export async function getClients(userId) {
  if (IS_E2E) return store.listClients(userId).map(enrichClient)
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(enrichClient)
}

export async function createClient(userId, fields) {
  if (IS_E2E) return enrichClient(store.insertClient({ ...fields, user_id: userId }))
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...fields, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return enrichClient(data)
}

export async function createClients(userId, rows) {
  if (IS_E2E) return store.insertClients(rows.map(fields => ({ ...fields, user_id: userId }))).map(enrichClient)
  const { data, error } = await supabase
    .from('clients')
    .insert(rows.map(fields => ({ ...fields, user_id: userId })))
    .select()
  if (error) throw error
  return data.map(enrichClient)
}

export async function deleteClient(clientId) {
  if (IS_E2E) return store.removeClient(clientId)
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
  if (error) throw error
}

export async function getProfile(userId) {
  if (IS_E2E) return store.getProfileFor(userId)
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

const SESSION_FIELD_MAP = {
  sections: 'sections',
  status: 'status',
  sectionsWithData: 'sections_with_data',
  sectionsApproved: 'sections_approved',
  documents: 'documents',
  clientProfile: 'client_profile',
  result: 'result',
  consentGranted: 'consent_granted',
  consentGrantedAt: 'consent_granted_at',
  progressNarrativeText: 'progress_narrative_text',
  clientName: 'client_name',
  bcbaName: 'bcba_name',
}

function toDbPatch(patch) {
  const out = {}
  for (const [jsKey, value] of Object.entries(patch)) {
    const dbKey = SESSION_FIELD_MAP[jsKey]
    if (dbKey) out[dbKey] = value
  }
  return out
}

function fromDbRow(row) {
  if (!row) return row
  const out = {}
  for (const [jsKey, dbKey] of Object.entries(SESSION_FIELD_MAP)) {
    if (dbKey in row) out[jsKey] = row[dbKey]
  }
  out.id = row.id
  out.clientId = row.client_id
  out.bcbaId = row.bcba_id
  out.sessionType = row.session_type
  out.createdAt = row.created_at
  out.updatedAt = row.updated_at
  return out
}

export async function getAssessmentSessionsByBcba(bcbaId) {
  if (IS_E2E) return store.sessionsByBcba(bcbaId).map(fromDbRow)
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('bcba_id', bcbaId)
  if (error) throw error
  return data.map(fromDbRow)
}

export async function getAssessmentSession(clientId) {
  if (IS_E2E) return fromDbRow(store.sessionByClient(clientId))
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  return fromDbRow(data)
}

export async function createAssessmentSession(clientId, bcbaId, patch) {
  if (IS_E2E) return fromDbRow(store.insertSession({ client_id: clientId, bcba_id: bcbaId, ...toDbPatch(patch) }))
  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({ client_id: clientId, bcba_id: bcbaId, ...toDbPatch(patch) })
    .select()
    .single()
  if (error) throw error
  return fromDbRow(data)
}

export async function updateAssessmentSession(sessionId, patch) {
  if (IS_E2E) return store.updateSession(sessionId, { ...toDbPatch(patch), updated_at: new Date().toISOString() })
  const { error } = await supabase
    .from('assessment_sessions')
    .update({ ...toDbPatch(patch), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}
