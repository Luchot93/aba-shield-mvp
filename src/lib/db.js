import { supabase } from './supabase.js'

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
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(enrichClient)
}

export async function createClient(userId, fields) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...fields, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return enrichClient(data)
}

export async function getAssessmentSession(clientId) {
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createAssessmentSession(clientId, bcbaId, initialSections) {
  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({ client_id: clientId, bcba_id: bcbaId, sections: initialSections })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAssessmentSession(sessionId, patch) {
  const { error } = await supabase
    .from('assessment_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}
