import { supabase } from './supabase.js'
import { IS_E2E } from './e2e/flag.js'
import * as store from './e2e/store.js'
import { mkChecklist } from '../constants/checklist.js'

const PHASE2_DEFAULTS = {
  assessment_session: null,
  service_session_logs: [],
  reassessment_sessions: [],
  caregiver_training_session_logs: [],
  documents: [],
  activity_log: [],
}

function enrichClient(row) {
  return { checklist: mkChecklist(), case_notes: [], ...PHASE2_DEFAULTS, ...row }
}

let staffNameMapCache = null

async function getStaffNameMap() {
  if (staffNameMapCache) return staffNameMapCache
  const { data, error } = await supabase.from('staff').select('user_id, name')
  if (error) throw error
  staffNameMapCache = new Map(data.map(s => [s.user_id, s.name]))
  return staffNameMapCache
}

async function getChecklistItemsByClientIds(clientIds) {
  const map = {}
  for (const id of clientIds) map[id] = mkChecklist()
  if (!clientIds.length) return map
  const { data, error } = await supabase.from('checklist_items').select('*').in('client_id', clientIds)
  if (error) throw error
  for (const row of data) {
    const base = map[row.client_id]
    const sec = base?.[row.stage]
    if (!sec || !(row.item_key in sec)) continue
    sec[row.item_key] = typeof sec[row.item_key] === 'boolean' ? !!row.is_complete : (row.value ?? '')
  }
  return map
}

async function getDocumentsByClientIds(clientIds) {
  const map = {}
  for (const id of clientIds) map[id] = []
  if (!clientIds.length) return map
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .in('client_id', clientIds)
    .order('uploaded_at', { ascending: true })
  if (error) throw error

  const paths = data.filter(d => d.storage_path).map(d => d.storage_path)
  let signedByPath = {}
  if (paths.length) {
    const { data: signed, error: signErr } = await supabase.storage.from('client-documents').createSignedUrls(paths, 3600)
    if (!signErr && signed) signed.forEach((s, i) => { if (s?.signedUrl) signedByPath[paths[i]] = s.signedUrl })
  }

  const staffMap = await getStaffNameMap()
  for (const row of data) {
    map[row.client_id].push({
      id: row.id,
      type: row.doc_type,
      label: row.file_name,
      uploaded_at: row.uploaded_at,
      by: staffMap.get(row.uploaded_by) ?? 'Unknown',
      stage: row.stage,
      ...(row.field_label ? { field: row.field_label } : {}),
      ...(signedByPath[row.storage_path] ? { dataUrl: signedByPath[row.storage_path] } : {}),
    })
  }
  return map
}

async function getCaseNotesByClientIds(clientIds) {
  const map = {}
  for (const id of clientIds) map[id] = []
  if (!clientIds.length) return map
  const { data, error } = await supabase
    .from('case_notes')
    .select('*')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  const staffMap = await getStaffNameMap()
  for (const row of data) {
    map[row.client_id].push({
      id: row.id,
      text: row.text,
      author: staffMap.get(row.author_id) ?? 'Unknown',
      timestamp: row.created_at,
      stage: row.stage,
    })
  }
  return map
}

async function getActivityLogByClientIds(clientIds) {
  const map = {}
  for (const id of clientIds) map[id] = []
  if (!clientIds.length) return map
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  const staffMap = await getStaffNameMap()
  for (const row of data) {
    map[row.client_id].push({
      id: row.id,
      action: row.action,
      ts: row.created_at,
      by: staffMap.get(row.actor_id) ?? 'Unknown',
      ...(row.detail?.reason ? { reason: row.detail.reason } : {}),
    })
  }
  return map
}

export async function setChecklistItem(clientId, stage, itemKey, value) {
  const { data: { user } } = await supabase.auth.getUser()
  const isBoolean = typeof value === 'boolean'
  const patch = isBoolean
    ? { is_complete: value, completed_by: value ? (user?.id ?? null) : null, completed_at: value ? new Date().toISOString() : null }
    : { value }
  const { data, error } = await supabase
    .from('checklist_items')
    .upsert({ client_id: clientId, stage, item_key: itemKey, ...patch }, { onConflict: 'client_id,stage,item_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadDocument(clientId, stage, file, docType, fieldLabel) {
  const { data: { user } } = await supabase.auth.getUser()
  const path = `${clientId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('client-documents').upload(path, file)
  if (uploadError) throw uploadError
  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: clientId,
      stage,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      uploaded_by: user?.id ?? null,
      doc_type: docType,
      ...(fieldLabel ? { field_label: fieldLabel } : {}),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addCaseNote(clientId, stage, text) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('case_notes')
    .insert({ client_id: clientId, author_id: user?.id ?? null, stage, text })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getClients(userId) {
  if (IS_E2E) return store.listClients(userId).map(enrichClient)
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error

  const clientIds = data.map(c => c.id)
  const [checklistMap, documentsMap, caseNotesMap, activityMap] = await Promise.all([
    getChecklistItemsByClientIds(clientIds),
    getDocumentsByClientIds(clientIds),
    getCaseNotesByClientIds(clientIds),
    getActivityLogByClientIds(clientIds),
  ])

  return data.map(row => ({
    ...enrichClient(row),
    checklist: checklistMap[row.id] ?? mkChecklist(),
    documents: documentsMap[row.id] ?? [],
    case_notes: caseNotesMap[row.id] ?? [],
    activity_log: activityMap[row.id] ?? [],
  }))
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

export async function getStaff() {
  const { data, error } = await supabase.from('staff').select('*')
  if (error) throw error
  return data
}

export async function createStaff(staffData) {
  const { data, error } = await supabase
    .from('staff')
    .insert(staffData)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getStaffByUserIds(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return []
  const { data, error } = await supabase.from('staff').select('*').in('user_id', ids)
  if (error) throw error
  return data
}

export async function getAdminStaff() {
  const { data: admins, error: adminsError } = await supabase.from('profiles').select('id').eq('role', 'admin')
  if (adminsError) throw adminsError
  const adminIds = admins.map(a => a.id)
  if (!adminIds.length) return []
  const { data, error } = await supabase.from('staff').select('*').in('user_id', adminIds)
  if (error) throw error
  return data
}

export async function updateStaff(staffId, patch) {
  const { data, error } = await supabase
    .from('staff')
    .update(patch)
    .eq('id', staffId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(clientId, patch) {
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', clientId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getActivityLog(clientId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function logActivity(clientId, action, detail) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('activity_log')
    .insert({ client_id: clientId, actor_id: user?.id ?? null, action, ...(detail ? { detail } : {}) })
    .select()
    .single()
  if (error) throw error
  return data
}
