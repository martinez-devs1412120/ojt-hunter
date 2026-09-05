let _client = null;

function sb() {
  // Guard a missing config.js (fresh clone) so isConfigured() can show setup UI
  if (typeof SUPABASE_CONFIG === 'undefined') return null;
  if (!SUPABASE_CONFIG.url?.startsWith('https://')) return null;
  if (!_client) {
    _client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
  return _client;
}

function isConfigured() {
  return !!sb();
}
