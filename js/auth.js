const auth = {
  mode: 'signin',

  init() {
    const $ = id => document.getElementById(id);
    $('tab-signin').onclick = () => auth.setMode('signin');
    $('tab-signup').onclick = () => auth.setMode('signup');
    $('auth-form').onsubmit = e => auth.submit(e);
  },

  setMode(mode) {
    auth.mode = mode;
    document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
    document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
    document.getElementById('auth-submit').textContent =
      mode === 'signin' ? 'Sign in' : 'Create account';
    auth.hideHint();
  },

  hint(msg, ok) {
    const el = document.getElementById('auth-hint');
    el.textContent = msg;
    el.className = 'auth-hint ' + (ok ? 'ok' : 'error');
  },

  hideHint() {
    document.getElementById('auth-hint').className = 'auth-hint hidden';
  },

  async submit(e) {
    e.preventDefault();
    if (!isConfigured()) return;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
      if (auth.mode === 'signup') {
        const { error } = await sb().auth.signUp({ email, password });
        if (error) throw error;
        auth.hint('Account created! If email confirmation is enabled, check your inbox, then sign in.', true);
      } else {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      auth.hint(err.message, false);
    }
  },

  showScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  async watch() {
    const { data: { session } } = await sb().auth.getSession();
    if (session) await app.enter(session.user);
    sb().auth.onAuthStateChange(async (_event, s) => {
      if (s?.user && app.currentUser !== s.user.id) await app.enter(s.user);
      else if (!s && app.currentUser) app.leave();
    });
  }
};
