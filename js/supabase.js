let _client = null;

function sb() {
  if (!SUPABASE_CONFIG.url.startsWith('https://')) return null;
  if (!_client) {
    _client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
  return _client;
}

function isConfigured() {
  return !!sb();
}
