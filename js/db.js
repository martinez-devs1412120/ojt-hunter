// Status metadata and shared pure helpers live in js/logic.js
// (STATUSES, STATUS_LABELS, STATUS_COLORS, sanitizeUrl, …).

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

// ---- Cloud file storage (private 'vault-files' bucket, one folder per user)
const VAULT_BUCKET = 'vault-files';
const VAULT_MAX_BYTES = 10 * 1024 * 1024;
const VAULT_ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];

// Whitelist of (ext -> [allowed browser-reported MIME types]) — defense
// in depth on top of the bucket's server-side allowed_mime_types list.
const VAULT_MIME = {
  pdf:  ['application/pdf'],
  png:  ['image/png'],
  jpg:  ['image/jpeg'], jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  doc:  ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

function validateVaultFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!VAULT_ALLOWED_EXT.includes(ext)) {
    return 'Allowed file types: ' + VAULT_ALLOWED_EXT.join(', ');
  }
  if (file.size > VAULT_MAX_BYTES) return 'File is too large — 10 MB max';
  // file.type is empty in some browsers; treat as "unknown" and let the
  // server-side bucket MIME check reject it if it's truly wrong.
  const allowedMimes = VAULT_MIME[ext];
  if (file.type && allowedMimes && !allowedMimes.includes(file.type)) {
    return 'File extension does not match its content type';
  }
  return null;
}

// Objects live at {user_id}/{timestamp}-{safe-name}; RLS on the bucket
// confines every operation to the caller's own folder.
async function uploadVaultFile(file) {
  const uid = await currentUserId();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);
  const path = `${uid}/${Date.now()}-${safeName}`;
  // content-disposition: inline → browser previews PDFs/images instead of
  // downloading. The bucket MIME whitelist + our validateVaultFile both
  // still gate the file type.
  const { error } = await sb().storage.from(VAULT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
    metadata: { original_name: safeName }
  });
  if (error) throw error;
  return path;
}

async function deleteStorageObject(path) {
  if (!path) return;
  const { error } = await sb().storage.from(VAULT_BUCKET).remove([path]);
  if (error) throw error;
}

// Short-lived signed URL. defaults to 'inline' (browser previews the
// file in-place); 'attachment' (forces download) is used when copying
// a link to paste into an email.
async function createSignedUrl(path, expiresInSeconds = 3600, disposition = 'inline') {
  const { data, error } = await sb().storage.from(VAULT_BUCKET)
    .createSignedUrl(path, expiresInSeconds, { download: disposition === 'attachment' });
  if (error) throw error;
  return data.signedUrl;
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
