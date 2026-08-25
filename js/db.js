const STATUSES = ['to_apply', 'applied', 'interview', 'offer', 'rejected'];
const STATUS_LABELS = {
  to_apply: 'To Apply',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected'
};
const STATUS_COLORS = {
  to_apply: '#8b98ab',
  applied: '#4f8cff',
  interview: '#e2b93d',
  offer: '#3fb96f',
  rejected: '#ef5350'
};

function sanitizeUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch (e) { return null; }
}

async function fetchApplications() {
  const { data, error } = await sb().from('applications')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function insertApplication(fields) {
  const user = (await sb().auth.getUser()).data.user;
  const { data, error } = await sb().from('applications')
    .insert({ ...fields, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateApplication(id, fields) {
  const { data, error } = await sb().from('applications')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteApplication(id) {
  const { error } = await sb().from('applications').delete().eq('id', id);
  if (error) throw error;
}

async function fetchDocuments() {
  const { data, error } = await sb().from('documents')
    .select('*')
    .order('type').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertDocument(fields) {
  const user = (await sb().auth.getUser()).data.user;
  const { data, error } = await sb().from('documents')
    .insert({ ...fields, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateDocument(id, fields) {
  const { data, error } = await sb().from('documents')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteDocument(id) {
  const { error } = await sb().from('documents').delete().eq('id', id);
  if (error) throw error;
}

async function fetchNotes(applicationId) {
  const { data, error } = await sb().from('notes')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertNote(applicationId, content) {
  const user = (await sb().auth.getUser()).data.user;
  const { data, error } = await sb().from('notes')
    .insert({ application_id: applicationId, content, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteNote(id) {
  const { error } = await sb().from('notes').delete().eq('id', id);
  if (error) throw error;
}
