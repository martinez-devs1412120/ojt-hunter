const SUPABASE_CONFIG = {
  url: 'https://ixekzipbbmbbsquicatc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZWt6aXBiYm1iYnNxdWljYXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NjI3MjUsImV4cCI6MjEwMzIzODcyNX0.bCp7J5vovEkQQ7t5EIfmiCert-bQbFJ26b0NPFB2FAc'
};

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
