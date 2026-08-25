(function () {
  let connect = "'self'";
  try {
    const u = new URL(SUPABASE_CONFIG.url);
    if (u.protocol === 'https:') {
      connect += ' https://' + u.host + ' wss://' + u.host;
    }
  } catch (e) {}

  const csp = [
    "default-src 'none'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    'connect-src ' + connect,
    "form-action 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "object-src 'none'"
  ].join('; ');

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = csp;
  document.head.prepend(meta);
})();
