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

// getSession reads the local session (refreshing if expired) — no extra
// network round-trip per write, unlike auth.getUser().
async function currentUserId() {
  const { data, error } = await sb().auth.getSession();
  if (error) throw error;
  const user = data?.session?.user;
  if (!user) throw new Error('Not signed in');
  return user.id;
}

async function fetchApplications() {
  const { data, error } = await sb().from('applications')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function insertApplication(fields) {
  const user_id = await currentUserId();
  const { data, error } = await sb().from('applications')
    .insert({ ...fields, user_id })
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
  const user_id = await currentUserId();
  const { data, error } = await sb().from('documents')
    .insert({ ...fields, user_id })
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
  const user_id = await currentUserId();
  const { data, error } = await sb().from('notes')
    .insert({ application_id: applicationId, content, user_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchAllNotes() {
  const { data, error } = await sb().from('notes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Used by import: merge rows by id (owned rows are updated, unknown ids are
// inserted). Chunked to stay under request size limits.
async function upsertRows(table, rows) {
  if (!rows.length) return 0;
  const user_id = await currentUserId();
  const CHUNK = 50;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(r => ({ ...r, user_id }));
    const { error } = await sb().from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
    done += chunk.length;
  }
  return done;
}

async function deleteNote(id) {
  const { error } = await sb().from('notes').delete().eq('id', id);
  if (error) throw error;
}
