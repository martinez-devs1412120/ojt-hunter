const app = {
  currentUser: null,

  async enter(user) {
    if (!isConfigured()) return;
    app.currentUser = user.id;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    try {
      await Promise.all([kanban.load(), vault.load()]);
      reminders.notifyDaily(kanban.apps);
    } catch (err) { toast(err.message, 'err'); }
  },

  leave() {
    app.currentUser = null;
    kanban.apps = [];
    vault.docs = [];
    document.getElementById('app').classList.add('hidden');
    auth.showScreen();
  },

  init() {
    auth.init();
    kanban.init();
    vault.init();
    reminders.init();

    document.querySelectorAll('.tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + tab.dataset.view).classList.add('active');
      };
    });

    document.getElementById('btn-signout').onclick = async () => {
      await sb().auth.signOut();
    };

    document.getElementById('empty-add-app').onclick = () => kanban.openModal(null);
    document.getElementById('empty-add-doc').onclick = () => vault.openModal(null);

    document.querySelectorAll('.modal .cancel-btn').forEach(btn => {
      btn.onclick = () => closeAllModals();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAllModals();
    });

    window.addEventListener('unhandledrejection', e => {
      toast(e.reason?.message || 'Unexpected error', 'err');
    });
    window.addEventListener('error', e => {
      if (e.message) toast('Error: ' + e.message, 'err');
    });
    window.addEventListener('offline', () => toast('You are offline — changes will fail until reconnect', 'err'));
    window.addEventListener('online', () => toast('Back online', 'ok'));

    if (!isConfigured()) {
      const warn = document.getElementById('setup-warning');
      warn.innerHTML =
        'Not connected yet.<br>1) Create a free project at <b>supabase.com</b><br>' +
        '2) Run <b>sql/schema.sql</b> in the SQL Editor<br>' +
        '3) Paste your URL + anon key into <b>js/config.js</b>';
      warn.classList.remove('hidden');
      document.getElementById('auth-form').querySelectorAll('input,button')
        .forEach(el => el.disabled = true);
      document.getElementById('auth-submit').textContent = 'Setup required';
      return;
    }
    auth.watch();
  }
};

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function closeAllModals() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
}

document.addEventListener('DOMContentLoaded', () => app.init());
