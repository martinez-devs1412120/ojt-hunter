const auth = {
  mode: 'signin',
  // Recovery links land on the page with #access_token=...&type=recovery.
  // Captured before the Supabase client consumes the URL fragment.
  needsNewPassword: location.hash.includes('type=recovery'),

  init() {
    const $ = id => document.getElementById(id);
    $('tab-signin').onclick = () => auth.setMode('signin');
    $('tab-signup').onclick = () => auth.setMode('signup');
    $('btn-forgot').onclick = () => auth.setMode('reset');
    $('auth-form').onsubmit = e => auth.submit(e);

    $('form-password').onsubmit = async e => {
      e.preventDefault();
      const p1 = $('p-pass').value, p2 = $('p-pass2').value;
      const btn = e.target.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      if (p1 !== p2) { auth.pHint('Passwords do not match'); return; }
      if (p1.length < 8) { auth.pHint('Use at least 8 characters'); return; }
      if (!isConfigured()) return;
      btn.disabled = true;
      try {
        const { error } = await sb().auth.updateUser({ password: p1 });
        if (error) throw error;
        e.target.reset();
        closeAllModals();
        history.replaceState(null, '', location.pathname + location.search);
        toast('Password updated', 'ok');
      } catch (err) {
        auth.pHint(err.message);
      } finally {
        btn.disabled = false;
      }
    };
  },

  setMode(mode) {
    auth.mode = mode;
    const isReset = mode === 'reset';
    document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
    document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
    document.getElementById('field-password').classList.toggle('hidden', isReset);
    document.getElementById('btn-forgot').classList.toggle('hidden', isReset);
    document.getElementById('auth-submit').textContent =
      mode === 'signin' ? 'Sign in' :
      mode === 'signup' ? 'Create account' : 'Send reset link';
    auth.hideHint();
  },

  hint(msg, ok) {
    const el = document.getElementById('auth-hint');
    el.textContent = msg;
    el.className = 'auth-hint ' + (ok ? 'ok' : 'error');
  },

  pHint(msg) {
    const el = document.getElementById('p-hint');
    el.textContent = msg;
    el.className = 'auth-hint error';
  },

  hideHint() {
    document.getElementById('auth-hint').className = 'auth-hint hidden';
  },

  promptNewPassword() {
    auth.needsNewPassword = false;
    document.getElementById('modal-password').showModal();
  },

  async submit(e) {
    e.preventDefault();
    if (!isConfigured()) return;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      if (auth.mode === 'reset') {
        const { error } = await sb().auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + location.pathname
        });
        if (error) throw error;
        // Generic wording on purpose — don't reveal whether the account exists
        auth.hint('If that email is registered, a reset link is on the way. Add your deployed URL under Supabase Auth → URL Configuration → Redirect URLs.', true);
      } else if (auth.mode === 'signup') {
        const { error } = await sb().auth.signUp({ email, password });
        if (error) throw error;
        document.getElementById('auth-password').value = '';
        auth.hint('Account created! If email confirmation is enabled, check your inbox, then sign in.', true);
      } else {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
        document.getElementById('auth-password').value = '';
      }
    } catch (err) {
      auth.hint(err.message, false);
    } finally {
      btn.disabled = false;
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
      if (_event === 'PASSWORD_RECOVERY') {
        auth.needsNewPassword = true;
        // If enter() is still loading, the flag makes it prompt when done
        if (app.currentUser) auth.promptNewPassword();
      }
      if (s?.user && app.currentUser !== s.user.id) await app.enter(s.user);
      else if (!s && app.currentUser) app.leave();
    });
  }
};
