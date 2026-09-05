const app = {
  currentUser: null,
  activePrep: 'questions',

  async enter(user) {
    if (!isConfigured()) return;
    app.currentUser = user.id;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('avatar').textContent =
      (user.email[0] || '?').toUpperCase();
    document.getElementById('greeting').textContent =
      `Welcome back, ${displayName(user.email)}!`;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    try {
      await Promise.all([kanban.load(), vault.load()]);
      reminders.notifyDaily(kanban.apps);
      app.renderStatsView(kanban.apps);
      app.renderPrep();
    } catch (err) { toast(err.message, 'err'); }
  },

  renderStats(apps) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let active = 0, interviewing = 0, offers = 0, overdue = 0;
    for (const a of apps) {
      if (a.status !== 'rejected') active++;
      if (a.status === 'interview') interviewing++;
      if (a.status === 'offer') offers++;
      if (a.deadline && !['offer', 'rejected'].includes(a.status)) {
        const due = new Date(a.deadline + 'T00:00:00');
        if (due < today) overdue++;
      }
    }
    setNum('stat-total', apps.length);
    setNum('stat-active', active);
    setNum('stat-interview', interviewing);
    setNum('stat-offer', offers);
    setNum('stat-overdue', overdue);
  },

  renderStatsView(apps) {
    const applied = apps.filter(a => a.applied_at || a.status !== 'to_apply').length;
    const interviewed = apps.filter(a =>
      a.interviewed_at || ['interview', 'offer'].includes(a.status)).length;
    const offered = apps.filter(a => a.offered_at || a.status === 'offer').length;

    const rateAI = applied ? Math.round((interviewed / applied) * 100) : 0;
    const rateIO = interviewed ? Math.round((offered / interviewed) * 100) : 0;
    setNum('stat-rate-ai', rateAI + '%');
    setNum('stat-rate-io', rateIO + '%');

    // Exact once the interviewed_at/offered_at columns exist (sql/schema.sql);
    // rows from before that fall back to updated_at as the stage date.
    const stageDate = (a, col, activeStatuses) =>
      a[col] ? new Date(a[col])
        : (activeStatuses.includes(a.status) && a.updated_at ? new Date(a.updated_at) : null);

    let sumDI = 0, cntDI = 0;
    for (const a of apps) {
      const from = a.applied_at ? new Date(a.applied_at) : null;
      const to = stageDate(a, 'interviewed_at', ['interview', 'offer']);
      if (from && to && to >= from) { sumDI += (to - from) / 864e5; cntDI++; }
    }
    setNum('stat-avg-di', cntDI ? Math.round(sumDI / cntDI) + 'd' : '—');

    let sumDO = 0, cntDO = 0;
    for (const a of apps) {
      const from = stageDate(a, 'interviewed_at', ['interview', 'offer']);
      const to = stageDate(a, 'offered_at', ['offer']);
      if (from && to && to >= from) { sumDO += (to - from) / 864e5; cntDO++; }
    }
    setNum('stat-avg-do', cntDO ? Math.round(sumDO / cntDO) + 'd' : '—');

    app.renderFunnel(apps);
    app.renderSources(apps);
  },

  renderFunnel(apps) {
    const stages = STATUSES.map(key => ({
      key, label: STATUS_LABELS[key], color: STATUS_COLORS[key]
    }));
    const counts = {};
    for (const s of stages) counts[s.key] = apps.filter(a => a.status === s.key).length;
    const max = Math.max(1, ...Object.values(counts));

    const el = document.getElementById('funnel-steps');
    el.innerHTML = '';
    for (const s of stages) {
      const pct = Math.round((counts[s.key] / max) * 100);
      const row = document.createElement('div');
      row.className = 'funnel-step';
      const label = document.createElement('span');
      label.className = 'funnel-step-label';
      label.textContent = s.label;
      const bar = document.createElement('div');
      bar.className = 'funnel-step-bar';
      const fill = document.createElement('span');
      fill.className = 'funnel-step-fill';
      fill.style.width = pct + '%';
      fill.style.background = s.color;
      bar.appendChild(fill);
      const cnt = document.createElement('span');
      cnt.className = 'funnel-step-count';
      cnt.textContent = counts[s.key];
      row.append(label, bar, cnt);
      el.appendChild(row);
    }
  },

  renderSources(apps) {
    const sourceCounts = {};
    for (const a of apps) {
      if (a.source_url) {
        try {
          const host = new URL(a.source_url).hostname.replace('www.', '');
          sourceCounts[host] = (sourceCounts[host] || 0) + 1;
        } catch {}
      }
    }
    const sorted = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const el = document.getElementById('source-list');
    el.innerHTML = '';
    if (!sorted.length) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--faint);font-size:.85rem;text-align:center;padding:1rem';
      p.textContent = 'Add job post URLs to track sources';
      el.appendChild(p);
      return;
    }
    for (const [src, cnt] of sorted) {
      const item = document.createElement('div');
      item.className = 'source-item';
      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = src;
      const meta = document.createElement('div');
      meta.className = 'source-meta';
      const span = document.createElement('span');
      span.textContent = cnt + ' application' + (cnt > 1 ? 's' : '');
      meta.appendChild(span);
      item.append(name, meta);
      el.appendChild(item);
    }
  },

  renderPrep() {
    const tabs = document.querySelectorAll('.prep-tab');
    const content = document.getElementById('prep-content');
    if (!tabs.length) return;
    const sections = {
      questions: `<div class="prep-section active">
        <div class="prep-q"><h4>Tell me about yourself</h4><ul><li><strong>60-second pitch:</strong> Name, degree, key skill, what you want, why this company</li><li>Tailor to the role — mention one project that maps to their stack</li></ul></div>
        <div class="prep-q"><h4>Why this company?</h4><ul><li>Research: recent news, tech blog, values, product</li><li>Connect your goal to their mission</li></ul></div>
        <div class="prep-q"><h4>Walk me through a project</h4><ul><li>Context → Your role → Challenge → Action (YOURS) → Result (metrics)</li><li>Prepare 3 stories: one technical, one teamwork, one failure/learning</li></ul></div>
        <div class="prep-q"><h4>Strengths & weaknesses</h4><ul><li>Strength: pick one from job desc, give proof</li><li>Weakness: real but fixable, show what you're doing about it</li></ul></div>
        <div class="prep-q"><h4>Where do you see yourself in 2 years?</h4><ul><li>Growth in skill + impact, not title</li><li>Align with their career path (mention senior eng / lead / specialist)</li></ul></div>`,
      star: `<div class="prep-section active">
        <div class="prep-q"><h4>STAR = Situation · Task · Action · Result</h4><ul><li><strong>S</strong> — 1 sentence context (team, project, deadline)</li><li><strong>T</strong> — What YOU owned (not "we")</li><li><strong>A</strong> — 3-4 specific steps YOU took (tools, decisions, tradeoffs)</li><li><strong>R</strong> — Measurable outcome (time saved, bugs fixed, users helped, grade)</li></ul></div>
        <div class="prep-grid">
          <div class="prep-card"><h4>Debugging a production issue</h4><ul><li>S: Payment API 5% error rate at peak</li><li>T: I owned the webhook handler</li><li>A: Added idempotency keys, retry queue, alerting</li><li>R: Errors → 0.1%, $12k recovered/mo</li></ul></div>
          <div class="prep-card"><h4>Learning a new framework fast</h4><ul><li>S: Team adopted Next.js mid-sprint</li><li>T: Build the dashboard page in 3 days</li><li>A: Built component library, wrote tests, paired with lead</li><li>R: Shipped on time, became team's go-to for Next.js</li></ul></div>
          <div class="prep-card"><h4>Resolving a team conflict</h4><ul><li>S: Two devs disagreed on API design</li><li>T: I mediated as the one who'd use both</li><li>A: Listed tradeoffs, proposed hybrid, wrote ADR</li><li>R: Consensus in 1 day, pattern reused in 3 repos</li></ul></div>
        </div>`,
      tech: `<div class="prep-section active">
        <div class="prep-grid">
          <div class="prep-card"><h4>JavaScript / TypeScript</h4><ul><li>Event loop, microtasks, <code>Promise.allSettled</code></li><li>Closures, <code>this</code>, arrow vs function</li><li>TS: generics, utility types, discriminated unions</li></ul></div>
          <div class="prep-card"><h4>React / Frontend</h4><ul><li>Hooks rules, <code>useMemo</code>/<code>useCallback</code> when</li><li>Suspense, error boundaries, server components</li><li>State: Context vs Zustand vs React Query</li></ul></div>
          <div class="prep-card"><h4>Backend / APIs</h4><ul><li>REST vs GraphQL, idempotency, pagination</li><li>Auth: JWT, refresh tokens, RBAC</li><li>SQL: indexes, transactions, N+1</li></ul></div>
          <div class="prep-card"><h4>CS Fundamentals</h4><ul><li>Big-O: search, sort, hash map, tree traversal</li><li>Concurrency: mutex, race condition, deadlock</li><li>System design: CAP, caching, rate limiting</li></ul></div>
        </div>`,
      behavioral: `<div class="prep-section active">
        <div class="prep-q"><h4>Tell me about a time you failed</h4><ul><li>Own it, what you learned, what changed</li></ul></div>
        <div class="prep-q"><h4>Disagreement with a teammate</h4><ul><li>Listen → data → compromise → document</li></ul></div>
        <div class="prep-q"><h4>Tight deadline / scope creep</h4><ul><li>Prioritize ruthlessly, communicate early, deliver MVP</li></ul></div>
        <div class="prep-q"><h4>Receiving tough feedback</h4><ul><li>Thank → clarify → act → follow up</li></ul></div>
        <div class="prep-q"><h4>Going above and beyond</h4><ul><li>Saw gap → proposed fix → built it → measured</li></ul></div>`
    };

    tabs.forEach(tab => {
      tab.onclick = () => {
        app.activePrep = tab.dataset.prep;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        content.innerHTML = sections[tab.dataset.prep] || '';
      };
    });
    const active = sections[app.activePrep] ? app.activePrep : 'questions';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.prep === active));
    content.innerHTML = sections[active];
  },

  async exportData() {
    let notes = [];
    try { notes = await fetchAllNotes(); } catch {}
    const data = {
      exportedAt: new Date().toISOString(),
      version: 2,
      applications: kanban.apps,
      documents: vault.docs,
      notes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ojt-hunter-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Backup downloaded — ${kanban.apps.length} applications, ${vault.docs.length} documents, ${notes.length} notes`, 'ok');
  },

  async importData(file) {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.applications) || !Array.isArray(data.documents)) {
      throw new Error('Invalid backup format');
    }
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const newId = () => (self.crypto && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
    const iso = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
    const date = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    const apps = data.applications
      .filter(r => r && typeof r.company === 'string' && r.company.trim())
      .map(r => ({
        id: UUID.test(r.id || '') ? r.id : newId(),
        company: r.company.trim().slice(0, 120),
        position: str(r.position, 120) || 'OJT Intern',
        hr_email: str(r.hr_email, 254),
        source_url: sanitizeUrl(r.source_url),
        status: STATUSES.includes(r.status) ? r.status : 'to_apply',
        priority: ['low', 'medium', 'high'].includes(r.priority) ? r.priority : 'medium',
        deadline: date(r.deadline),
        follow_up_at: iso(r.follow_up_at),
        applied_at: iso(r.applied_at),
        interviewed_at: iso(r.interviewed_at),
        offered_at: iso(r.offered_at),
        ojt_hours: Number.isFinite(Number(r.ojt_hours)) && r.ojt_hours !== null && r.ojt_hours !== ''
          ? Math.min(10000, Math.max(0, Math.trunc(Number(r.ojt_hours)))) : null,
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at)
      }));
    const appIds = new Set(apps.map(a => a.id));

    const docs = data.documents
      .map(r => r && typeof r.name === 'string' ? { ...r, link: sanitizeUrl(r.link) } : null)
      .filter(r => r && r.name.trim() && r.link)
      .map(r => ({
        id: UUID.test(r.id || '') ? r.id : newId(),
        name: r.name.trim().slice(0, 120),
        type: vault.DOC_META[r.type] ? r.type : 'other',
        link: r.link,
        version: str(r.version, 60),
        notes: str(r.notes, 2000),
        created_at: iso(r.created_at)
      }));

    const notes = (Array.isArray(data.notes) ? data.notes : [])
      .filter(r => r && typeof r.content === 'string' && r.content.trim()
        && appIds.has(r.application_id))
      .map(r => ({
        id: UUID.test(r.id || '') ? r.id : newId(),
        application_id: r.application_id,
        content: r.content.trim().slice(0, 10000),
        created_at: iso(r.created_at)
      }));

    const nApps = await upsertRows('applications', apps);
    const nDocs = await upsertRows('documents', docs);
    const nNotes = await upsertRows('notes', notes);
    await Promise.all([kanban.load(), vault.load()]);
    toast(`Imported ${nApps} applications, ${nDocs} documents, ${nNotes} notes (merge — nothing deleted)`, 'ok');
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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    document.querySelectorAll('.nav-item[data-view]').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.nav-item[data-view]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + tab.dataset.view).classList.add('active');
        if (tab.dataset.view === 'stats') app.renderStatsView(kanban.apps);
        if (tab.dataset.view === 'prep') app.renderPrep();
      };
    });

    document.getElementById('btn-signout').onclick = async () => {
      await sb().auth.signOut();
    };

    document.getElementById('empty-add-app').onclick = () => kanban.openModal(null);
    document.getElementById('empty-add-doc').onclick = () => vault.openModal(null);

    document.getElementById('btn-export').onclick = () => app.exportData();
    document.getElementById('btn-import').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = async e => {
      const file = e.target.files[0];
      if (file) await app.importData(file);
      e.target.value = '';
    };

    document.querySelectorAll('.modal .cancel-btn').forEach(btn => {
      btn.onclick = () => closeAllModals();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAllModals();
        return;
      }
      if (!app.currentUser) return;
      if (e.target.matches('input, textarea, select')) return;
      switch (e.key.toLowerCase()) {
        case '/': e.preventDefault(); document.getElementById('board-search').focus(); break;
        case 'n': kanban.openModal(null); break;
        case 'b': app.switchView('board'); break;
        case 'v': app.switchView('vault'); break;
        case 'd': app.switchView('deadlines'); break;
        case 'p': app.switchView('prep'); break;
        case 's': app.switchView('stats'); break;
      }
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
  },

  switchView(view) {
    document.querySelectorAll('.nav-item[data-view]').forEach(t => t.classList.remove('active'));
    const target = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    if (view === 'stats') app.renderStatsView(kanban.apps);
    if (view === 'prep') app.renderPrep();
  }
};

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function setNum(id, n) {
  document.getElementById(id).textContent = n;
}

function displayName(email) {
  const raw = (email.split('@')[0].match(/[A-Za-z]+/) || ['hunter'])[0];
  return (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 14);
}

function closeAllModals() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
}

document.addEventListener('DOMContentLoaded', () => app.init());